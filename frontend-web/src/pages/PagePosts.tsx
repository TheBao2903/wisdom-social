import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    ArrowLeft, Loader2, CheckCircle, XCircle, Clock, 
    FileText, Image as ImageIcon, MoreVertical, Trash2, ShieldAlert
} from "lucide-react";
import pageService from "../services/pageService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";

interface Post {
    _id: string;
    content?: string;
    images?: string[];
    userId?: number;
    createdAt?: string;
}

type TabType = "approved" | "pending";

export default function PagePosts() {
    const { pageId } = useParams();
    const navigate = useNavigate();
    const currentUser = useCurrentUser();
    
    const [activeTab, setActiveTab] = useState<TabType>("approved");
    const [approvedPosts, setApprovedPosts] = useState<Post[]>([]);
    const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    const loadPosts = useCallback(async () => {
        if (!pageId || !currentUser?.id) return;
        
        setLoading(true);
        try {
            // Get page data and members list to check access
            const [pageData, membersList] = await Promise.all([
                pageService.getPageById(Number(pageId)),
                pageService.getPageMembers(Number(pageId)),
            ]);
            
            // Check if current user is owner or admin
            const currentUserId = Number(currentUser.id);
            const pageOwnerId = pageData.createdBy?.id 
                ? Number(pageData.createdBy.id) 
                : (pageData.userId ? Number(pageData.userId) : null);
            
            const isOwner = currentUserId === pageOwnerId;
            const currentMember = membersList?.find(m => Number(m.userId) === currentUserId);
            const hasAdminRole = currentMember?.pageRole === "ADMIN" || currentMember?.pageRole === "MODERATOR";
            
            const hasAccess = isOwner || hasAdminRole;
            setIsAdmin(hasAccess);
            
            if (!hasAccess) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            const [approved, pending] = await Promise.all([
                pageService.getAllPostsOfPage(Number(pageId)),
                pageService.getPostsWaitingForApproval(Number(pageId)),
            ]);
            setApprovedPosts(approved || []);
            setPendingPosts(pending || []);
        } catch (error) {
            console.error("Error loading posts:", error);
        } finally {
            setLoading(false);
        }
    }, [pageId, currentUser?.id]);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    const handleApprovePost = async (postId: string) => {
        if (!pageId || !currentUser?.id) return;
        
        setActionLoading(postId);
        try {
            await pageService.approvePost(currentUser.id, Number(pageId), postId);
            // Move from pending to approved
            const post = pendingPosts.find(p => p._id === postId);
            if (post) {
                setPendingPosts(prev => prev.filter(p => p._id !== postId));
                setApprovedPosts(prev => [post, ...prev]);
            }
        } catch (error) {
            console.error("Error approving post:", error);
            alert("Không thể duyệt bài viết");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectPost = async (postId: string) => {
        if (!pageId || !currentUser?.id) return;
        
        if (!confirm("Bạn có chắc muốn từ chối bài viết này?")) return;
        
        setActionLoading(postId);
        try {
            await pageService.cancelApprovePost(currentUser.id, Number(pageId), postId);
            setPendingPosts(prev => prev.filter(p => p._id !== postId));
        } catch (error) {
            console.error("Error rejecting post:", error);
            alert("Không thể từ chối bài viết");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemovePost = async (postId: string) => {
        if (!pageId || !currentUser?.id) return;
        
        if (!confirm("Bạn có chắc muốn xóa bài viết này khỏi page?")) return;
        
        setActionLoading(postId);
        try {
            await pageService.removePostFromPage(currentUser.id, Number(pageId), postId);
            setApprovedPosts(prev => prev.filter(p => p._id !== postId));
        } catch (error) {
            console.error("Error removing post:", error);
            alert("Không thể xóa bài viết");
        } finally {
            setActionLoading(null);
        }
    };

    const handleApproveAll = async () => {
        if (!pageId || !currentUser?.id || pendingPosts.length === 0) return;
        
        if (!confirm(`Duyệt tất cả ${pendingPosts.length} bài viết?`)) return;
        
        setActionLoading("all");
        try {
            await pageService.approveAllPosts(currentUser.id, Number(pageId));
            setApprovedPosts(prev => [...pendingPosts, ...prev]);
            setPendingPosts([]);
        } catch (error) {
            console.error("Error approving all posts:", error);
            alert("Không thể duyệt tất cả bài viết");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectAll = async () => {
        if (!pageId || !currentUser?.id || pendingPosts.length === 0) return;
        
        if (!confirm(`Từ chối tất cả ${pendingPosts.length} bài viết?`)) return;
        
        setActionLoading("all");
        try {
            await pageService.cancelAllPosts(currentUser.id, Number(pageId));
            setPendingPosts([]);
        } catch (error) {
            console.error("Error rejecting all posts:", error);
            alert("Không thể từ chối tất cả bài viết");
        } finally {
            setActionLoading(null);
        }
    };

    const renderPostCard = (post: Post, isPending: boolean) => (
        <div
            key={post._id}
            className="p-4 bg-white dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#363636]"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    {isPending ? (
                        <Clock className="text-yellow-500" size={18} />
                    ) : (
                        <CheckCircle className="text-green-500" size={18} />
                    )}
                    <span className={`text-sm font-medium ${isPending ? "text-yellow-600" : "text-green-600"}`}>
                        {isPending ? "Chờ duyệt" : "Đã duyệt"}
                    </span>
                </div>
                <span className="text-xs text-gray-400">
                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString('vi-VN') : ''}
                </span>
            </div>

            {/* Content */}
            {post.content && (
                <p className="text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                    {post.content}
                </p>
            )}

            {/* Images */}
            {post.images && post.images.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto">
                    {post.images.slice(0, 3).map((img, idx) => (
                        <img
                            key={idx}
                            src={buildS3Url(img) || img}
                            alt={`Post image ${idx + 1}`}
                            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                        />
                    ))}
                    {post.images.length > 3 && (
                        <div className="w-20 h-20 rounded-lg bg-gray-200 dark:bg-[#363636] flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-500 text-sm">+{post.images.length - 3}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-[#363636]">
                {actionLoading === post._id ? (
                    <Loader2 className="animate-spin text-gray-400" size={20} />
                ) : isPending ? (
                    <>
                        <button
                            onClick={() => handleApprovePost(post._id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                        >
                            <CheckCircle size={16} />
                            Duyệt
                        </button>
                        <button
                            onClick={() => handleRejectPost(post._id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                        >
                            <XCircle size={16} />
                            Từ chối
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => handleRemovePost(post._id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm"
                    >
                        <Trash2 size={16} />
                        Xóa
                    </button>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        );
    }

    // Access denied view
    if (accessDenied) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <ShieldAlert size={64} className="text-red-500 mb-4" />
                <h2 className="text-xl font-semibold dark:text-white mb-2">Không có quyền truy cập</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-center">
                    Chỉ admin và owner mới có thể quản lý bài viết của page
                </p>
                <button
                    onClick={() => navigate(`/pages/${pageId}`)}
                    className="text-blue-500 hover:underline"
                >
                    Quay lại trang page
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate(`/pages/${pageId}/settings`)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#363636] rounded-full transition-colors"
                >
                    <ArrowLeft size={24} className="dark:text-white" />
                </button>
                <h1 className="text-2xl font-bold dark:text-white">Quản lý bài viết</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-[#363636]">
                <button
                    onClick={() => setActiveTab("approved")}
                    className={`pb-3 px-1 font-medium transition-colors ${
                        activeTab === "approved"
                            ? "text-blue-500 border-b-2 border-blue-500"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                    <FileText className="inline mr-2" size={18} />
                    Đã duyệt ({approvedPosts.length})
                </button>
                <button
                    onClick={() => setActiveTab("pending")}
                    className={`pb-3 px-1 font-medium transition-colors ${
                        activeTab === "pending"
                            ? "text-blue-500 border-b-2 border-blue-500"
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                    <Clock className="inline mr-2" size={18} />
                    Chờ duyệt ({pendingPosts.length})
                </button>
            </div>

            {/* Bulk Actions for Pending */}
            {activeTab === "pending" && pendingPosts.length > 0 && (
                <div className="flex items-center justify-end gap-3 mb-4">
                    {actionLoading === "all" ? (
                        <Loader2 className="animate-spin text-gray-400" size={20} />
                    ) : (
                        <>
                            <button
                                onClick={handleApproveAll}
                                className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                            >
                                <CheckCircle size={16} />
                                Duyệt tất cả
                            </button>
                            <button
                                onClick={handleRejectAll}
                                className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                            >
                                <XCircle size={16} />
                                Từ chối tất cả
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Posts List */}
            <div className="space-y-4">
                {activeTab === "approved" && (
                    approvedPosts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            Chưa có bài viết nào được duyệt
                        </div>
                    ) : (
                        approvedPosts.map(post => renderPostCard(post, false))
                    )
                )}

                {activeTab === "pending" && (
                    pendingPosts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            Không có bài viết nào đang chờ duyệt
                        </div>
                    ) : (
                        pendingPosts.map(post => renderPostCard(post, true))
                    )
                )}
            </div>
        </div>
    );
}
