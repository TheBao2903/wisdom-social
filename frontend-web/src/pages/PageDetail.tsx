import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    ArrowLeft, Heart, UserPlus, Settings, Users, Loader2,
    Globe, Phone, Mail, MapPin, Link as LinkIcon,
    Clock, CheckCircle, XCircle, Lock, FileText,
    Trash2, Edit, Search, X, MessageCircle, Share2,
    ThumbsUp, Bell, MoreHorizontal, Camera, Flag,
    ChevronDown, UserCheck, UserMinus
} from "lucide-react";
import pageService, { type Page, type PageMember } from "../services/pageService";
import userService from "../services/userService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";
import type { User } from "../types";

type MemberStatus = "loading" | "none" | "pending" | "member" | "admin" | "owner" | "blocked";
type PageRole = "ADMIN" | "EDITOR" | "MODERATOR" | "ANALYST" | "USER";

const PAGE_ROLES: { label: string; value: PageRole }[] = [
    { label: 'Admin', value: 'ADMIN' },
    { label: 'Editor', value: 'EDITOR' },
    { label: 'Moderator', value: 'MODERATOR' },
    { label: 'Analyst', value: 'ANALYST' },
    { label: 'User', value: 'USER' },
];

interface Post {
    _id: string;
    content?: string;
    images?: string[];
    authorId?: string;
    createdAt?: string;
    likesCount?: number;
    commentsCount?: number;
}

interface PendingMember extends PageMember {
    user?: User;
}

function timeAgo(dateStr?: string) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return `${diff} giây trước`;
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PageDetail() {
    const { pageId } = useParams();
    const navigate = useNavigate();
    const currentUser = useCurrentUser();

    const [page, setPage] = useState<Page | null>(null);
    const [loading, setLoading] = useState(true);
    const [memberStatus, setMemberStatus] = useState<MemberStatus>("loading");
    const [memberCount, setMemberCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"posts" | "about" | "members" | "pending">("posts");

    const [posts, setPosts] = useState<Post[]>([]);
    const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);

    const [pendingRequests, setPendingRequests] = useState<PendingMember[]>([]);
    const [loadingPendingRequests, setLoadingPendingRequests] = useState(false);

    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [selectedRole, setSelectedRole] = useState<PageRole>("USER");
    const [isSearching, setIsSearching] = useState(false);
    const [isAddingMembers, setIsAddingMembers] = useState(false);
    const [members, setMembers] = useState<PageMember[]>([]);

    const [postActionLoading, setPostActionLoading] = useState<string | null>(null);
    const [requestActionLoading, setRequestActionLoading] = useState<number | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const loadPageData = useCallback(async () => {
        if (!pageId) return;
        setLoading(true);
        try {
            const [pageData, count] = await Promise.all([
                pageService.getPageById(Number(pageId)),
                pageService.getMemberCount(Number(pageId)),
            ]);
            setPage(pageData);
            setMemberCount(count);

            const currentUserId = currentUser?.id ? Number(currentUser.id) : null;
            const pageOwnerId = pageData.createdBy?.id
                ? Number(pageData.createdBy.id)
                : (pageData.userId ? Number(pageData.userId) : null);

            if (currentUserId && currentUserId === pageOwnerId) {
                setMemberStatus("owner");
            } else if (currentUserId) {
                try {
                    const membersList = await pageService.getPageMembers(Number(pageId));
                    const currentMember = membersList?.find(m => Number(m.userId) === currentUserId);
                    if (currentMember) {
                        if (currentMember.memberStatus === "BLOCKED" || currentMember.memberStatus === "REMOVED") {
                            setMemberStatus("blocked");
                        } else if (currentMember.memberStatus === "PENDING") {
                            setMemberStatus("pending");
                        } else if (currentMember.pageRole === "ADMIN" || currentMember.pageRole === "MODERATOR") {
                            setMemberStatus("admin");
                        } else if (currentMember.memberStatus === "ACTIVE") {
                            setMemberStatus("member");
                        } else {
                            setMemberStatus("none");
                        }
                    } else {
                        try {
                            const status = await pageService.getMemberStatus(Number(pageId), currentUserId);
                            setMemberStatus(status === "PENDING" ? "pending" : "none");
                        } catch {
                            setMemberStatus("none");
                        }
                    }
                } catch {
                    setMemberStatus("none");
                }
                try {
                    const interactionStatus = await pageService.getPageInteractionStatus(Number(pageId));
                    setIsLiked(interactionStatus.isLiked || false);
                    setIsFollowing(interactionStatus.isFollowing || false);
                } catch { }
            } else {
                setMemberStatus("none");
            }
        } catch (error) {
            console.error("Error loading page:", error);
        } finally {
            setLoading(false);
        }
    }, [pageId, currentUser?.id]);

    useEffect(() => { loadPageData(); }, [loadPageData]);

    const handleLike = async () => {
        if (!currentUser?.id || !pageId) return;
        setActionLoading(true);
        try {
            if (isLiked) {
                await pageService.cancelLikePage(currentUser.id, Number(pageId));
                setIsLiked(false);
            } else {
                await pageService.likePage(currentUser.id, Number(pageId));
                setIsLiked(true);
            }
        } catch (error) {
            console.error("Error toggling like:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!currentUser?.id || !pageId) return;
        setActionLoading(true);
        try {
            if (isFollowing) {
                await pageService.cancelFollowPage(currentUser.id, Number(pageId));
                setIsFollowing(false);
            } else {
                await pageService.followPage(currentUser.id, Number(pageId));
                setIsFollowing(true);
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleJoinRequest = async () => {
        if (!currentUser?.id || !pageId) return;
        setActionLoading(true);
        try {
            if (memberStatus === "pending") {
                await pageService.cancelJoinRequest(Number(pageId), currentUser.id);
                setMemberStatus("none");
            } else {
                await pageService.requestJoinPage(currentUser.id, Number(pageId));
                setMemberStatus("pending");
            }
        } catch (error) {
            console.error("Error handling join request:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const loadPosts = useCallback(async () => {
        if (!pageId) return;
        setLoadingPosts(true);
        try {
            const approvedPosts = await pageService.getAllPostsOfPage(Number(pageId));
            setPosts(approvedPosts || []);
        } catch (error) {
            console.error("Error loading posts:", error);
        } finally {
            setLoadingPosts(false);
        }
    }, [pageId]);

    const loadPendingPosts = useCallback(async () => {
        if (!pageId || !currentUser?.id) return;
        try {
            const pending = await pageService.getPostsWaitingForApproval(Number(pageId));
            setPendingPosts(pending || []);
        } catch (error) {
            console.error("Error loading pending posts:", error);
        }
    }, [pageId, currentUser?.id]);

    const loadPendingRequests = useCallback(async () => {
        if (!pageId) return;
        setLoadingPendingRequests(true);
        try {
            const requests = await pageService.getPendingJoinRequests(Number(pageId));
            const requestsWithUsers = await Promise.all(
                (requests || []).map(async (req) => {
                    try {
                        const user = await userService.getUserProfile(req.userId);
                        return { ...req, user: user as any };
                    } catch {
                        return req;
                    }
                })
            );
            setPendingRequests(requestsWithUsers);
        } catch (error) {
            console.error("Error loading pending requests:", error);
        } finally {
            setLoadingPendingRequests(false);
        }
    }, [pageId]);

    const loadMembers = useCallback(async () => {
        if (!pageId) return;
        try {
            const membersList = await pageService.getPageMembers(Number(pageId));
            setMembers(membersList || []);
        } catch (error) {
            console.error("Error loading members:", error);
        }
    }, [pageId]);

    useEffect(() => { loadPosts(); }, [loadPosts]);
    useEffect(() => {
        if (memberStatus === "owner" || memberStatus === "admin") {
            loadPendingPosts();
            loadPendingRequests();
            loadMembers();
        }
    }, [memberStatus, loadPendingPosts, loadPendingRequests, loadMembers]);

    useEffect(() => {
        if (!memberSearchQuery || memberSearchQuery.length < 2) {
            setSearchResults([]);
            return;
        }
        const timeoutId = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await userService.searchUserByUsername(memberSearchQuery);
                if (results && Array.isArray(results)) {
                    const memberIds = members.map(m => m.userId);
                    setSearchResults(results.filter(u => !memberIds.includes(Number(u.id))));
                } else {
                    setSearchResults([]);
                }
            } catch {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [memberSearchQuery, members]);

    const handleApprovePost = async (postId: string) => {
        if (!currentUser?.id || !pageId) return;
        setPostActionLoading(postId);
        try {
            await pageService.approvePost(currentUser.id, Number(pageId), postId);
            const post = pendingPosts.find(p => p._id === postId);
            if (post) {
                setPendingPosts(prev => prev.filter(p => p._id !== postId));
                setPosts(prev => [post, ...prev]);
            }
        } catch { alert("Không thể duyệt bài viết"); }
        finally { setPostActionLoading(null); }
    };

    const handleRejectPost = async (postId: string) => {
        if (!currentUser?.id || !pageId) return;
        if (!confirm("Bạn có chắc muốn từ chối bài viết này?")) return;
        setPostActionLoading(postId);
        try {
            await pageService.cancelApprovePost(currentUser.id, Number(pageId), postId);
            setPendingPosts(prev => prev.filter(p => p._id !== postId));
        } catch { alert("Không thể từ chối bài viết"); }
        finally { setPostActionLoading(null); }
    };

    const handleRemovePost = async (postId: string) => {
        if (!currentUser?.id || !pageId) return;
        if (!confirm("Bạn có chắc muốn xóa bài viết này?")) return;
        setPostActionLoading(postId);
        try {
            await pageService.removePostFromPage(currentUser.id, Number(pageId), postId);
            setPosts(prev => prev.filter(p => p._id !== postId));
        } catch { alert("Không thể xóa bài viết"); }
        finally { setPostActionLoading(null); }
    };

    const handleApproveRequest = async (userId: number) => {
        if (!pageId) return;
        setRequestActionLoading(userId);
        try {
            await pageService.approveJoinRequest(Number(pageId), userId);
            setPendingRequests(prev => prev.filter(r => r.userId !== userId));
            setMemberCount(prev => prev + 1);
        } catch { alert("Không thể duyệt yêu cầu"); }
        finally { setRequestActionLoading(null); }
    };

    const handleRejectRequest = async (userId: number) => {
        if (!pageId) return;
        setRequestActionLoading(userId);
        try {
            await pageService.rejectJoinRequest(Number(pageId), userId);
            setPendingRequests(prev => prev.filter(r => r.userId !== userId));
        } catch { alert("Không thể từ chối yêu cầu"); }
        finally { setRequestActionLoading(null); }
    };

    const handleDeletePage = async () => {
        if (!pageId || memberStatus !== "owner") return;
        if (!confirm("Bạn có chắc muốn XÓA page này? Hành động này không thể hoàn tác!")) return;
        if (!confirm("Xác nhận lần cuối: XÓA VĨNH VIỄN page này?")) return;
        try {
            await pageService.deletePage(Number(pageId));
            alert("Đã xóa page thành công");
            navigate("/pages");
        } catch { alert("Không thể xóa page"); }
    };

    const handleAddMembers = async () => {
        if (!pageId || selectedUsers.length === 0) return;
        setIsAddingMembers(true);
        try {
            await Promise.all(
                selectedUsers.map(user => pageService.addMember(Number(user.id), Number(pageId), selectedRole))
            );
            alert(`Đã thêm ${selectedUsers.length} thành viên!`);
            setShowAddMemberModal(false);
            setMemberSearchQuery("");
            setSearchResults([]);
            setSelectedUsers([]);
            setSelectedRole("USER");
            setMemberCount(prev => prev + selectedUsers.length);
            loadMembers();
        } catch { alert("Không thể thêm thành viên"); }
        finally { setIsAddingMembers(false); }
    };

    const toggleUserSelection = (user: User) => {
        const isSelected = selectedUsers.some(u => u.id === user.id);
        setSelectedUsers(prev => isSelected ? prev.filter(u => u.id !== user.id) : [...prev, user]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-[#18191a]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                        <Users size={24} className="text-white" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Đang tải trang...</p>
                </div>
            </div>
        );
    }

    if (!page) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-[#18191a]">
                <p className="text-gray-500 dark:text-gray-400 mb-4">Page không tồn tại</p>
                <button onClick={() => navigate("/pages")}
                    className="text-blue-500 hover:underline font-medium">
                    Quay lại danh sách
                </button>
            </div>
        );
    }

    const isOwnerOrAdmin = memberStatus === "owner" || memberStatus === "admin";
    const pendingCount = pendingRequests.length + pendingPosts.length;
    const tabs = [
        { id: "posts", label: "Bài viết" },
        { id: "about", label: "Giới thiệu" },
        ...(isOwnerOrAdmin ? [
            { id: "members", label: "Thành viên" },
            { id: "pending", label: "Chờ duyệt", badge: pendingCount },
        ] : []),
    ] as { id: string; label: string; badge?: number }[];

    return (
        <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#18191a]">
            {/* Cover + Header */}
            <div className="bg-white dark:bg-[#242526] shadow-sm">
                <div className="max-w-[1095px] mx-auto">
                    {/* Cover Image */}
                    <div className="relative h-[300px] md:h-[400px] rounded-b-lg overflow-hidden bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700">
                        {page.coverUrl && (
                            <img
                                src={buildS3Url(page.coverUrl)|| "https://via.placeholder.com/1200x400"}
                                alt="Cover"
                                className="w-full h-full object-cover"
                            />
                        )}
                        {/* Overlay gradient bottom */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                        {/* Back button */}
                        <button
                            onClick={() => navigate(-1)}
                            className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>

                        {isOwnerOrAdmin && (
                            <Link
                                to={`/pages/${pageId}/settings`}
                                className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                            >
                                <Camera size={16} />
                                <span className="hidden sm:inline">Chỉnh sửa ảnh bìa</span>
                            </Link>
                        )}
                    </div>

                    {/* Page identity */}
                    <div className="px-4 md:px-6 pb-0">
                        <div className="flex flex-col md:flex-row md:items-end gap-3 -mt-6 md:-mt-4 mb-4">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                <img
                                    src={buildS3Url(page.avatarUrl) || "https://via.placeholder.com/168"}
                                    alt={page.name}
                                    className="w-40 h-40 md:w-44 md:h-44 rounded-full object-cover border-4 border-white dark:border-[#242526] shadow-md bg-white dark:bg-[#3a3b3c]"
                                />
                                {isOwnerOrAdmin && (
                                    <button className="absolute bottom-2 right-2 w-9 h-9 bg-gray-200 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center hover:bg-gray-300 dark:hover:bg-[#4e4f50] transition-colors shadow-sm">
                                        <Camera size={16} className="text-gray-700 dark:text-gray-300" />
                                    </button>
                                )}
                            </div>

                            {/* Name & meta */}
                            <div className="flex-1 md:pb-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                                        {page.name}
                                    </h1>
                                    {page.isVerified && (
                                        <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                            <CheckCircle size={14} className="text-white" />
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-[15px] mt-0.5">
                                    {page.category}
                                    {page.username && <span className="mx-1">·</span>}
                                    {page.username && <span>@{page.username}</span>}
                                </p>
                                <div className="flex items-center gap-1 mt-1 text-gray-500 dark:text-gray-400 text-[15px]">
                                    <Users size={16} />
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        {memberCount.toLocaleString()}
                                    </span>
                                    <span>thành viên</span>
                                    <span className="mx-1">·</span>
                                    {page.status === "PRIVATE" ? (
                                        <span className="flex items-center gap-1"><Lock size={14} /> Riêng tư</span>
                                    ) : (
                                        <span className="flex items-center gap-1"><Globe size={14} /> Công khai</span>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 md:pb-4 md:ml-auto">
                                {/* Liked badge */}
                                {isLiked && (
                                    <span className="flex items-center gap-1 text-blue-500 text-sm font-medium">
                                        <ThumbsUp size={16} fill="currentColor" />
                                        Đã thích
                                    </span>
                                )}

                                {/* Like button */}
                                <button
                                    onClick={handleLike}
                                    disabled={actionLoading || !currentUser}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[15px] font-semibold transition-all ${
                                        isLiked
                                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100"
                                            : "bg-blue-500 text-white hover:bg-blue-600"
                                    }`}
                                >
                                    <ThumbsUp size={18} fill={isLiked ? "currentColor" : "none"} />
                                    {isLiked ? "Bỏ thích" : "Thích"}
                                </button>

                                {/* Follow button */}
                                <button
                                    onClick={handleFollow}
                                    disabled={actionLoading || !currentUser}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[15px] font-semibold transition-all ${
                                        isFollowing
                                            ? "bg-gray-200 text-gray-800 dark:bg-[#3a3b3c] dark:text-gray-200 hover:bg-gray-300"
                                            : "bg-gray-200 text-gray-800 dark:bg-[#3a3b3c] dark:text-gray-200 hover:bg-gray-300"
                                    }`}
                                >
                                    <Bell size={18} />
                                    {isFollowing ? "Đang theo dõi" : "Theo dõi"}
                                    <ChevronDown size={14} />
                                </button>

                                {/* Join button */}
                                {memberStatus === "none" && (
                                    <button
                                        onClick={handleJoinRequest}
                                        disabled={actionLoading || !currentUser}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-[#3a3b3c] text-gray-800 dark:text-gray-200 rounded-lg text-[15px] font-semibold hover:bg-gray-300 dark:hover:bg-[#4e4f50] transition-all"
                                    >
                                        <UserPlus size={18} />
                                        {page.status === "PRIVATE" ? "Xin tham gia" : "Tham gia"}
                                    </button>
                                )}

                                {memberStatus === "pending" && (
                                    <button
                                        onClick={handleJoinRequest}
                                        disabled={actionLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-[#3a3b3c] text-gray-800 dark:text-gray-200 rounded-lg text-[15px] font-semibold hover:bg-gray-300 transition-all"
                                    >
                                        <Clock size={18} />
                                        Đang chờ duyệt
                                    </button>
                                )}

                                {/* More options */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                                        className="flex items-center justify-center w-10 h-10 bg-gray-200 dark:bg-[#3a3b3c] text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-[#4e4f50] transition-all"
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                    {showMoreMenu && (
                                        <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#3a3b3c] rounded-xl shadow-xl border border-gray-200 dark:border-[#4e4f50] z-50 py-1 overflow-hidden">
                                            {isOwnerOrAdmin && (
                                                <>
                                                    <Link
                                                        to={`/pages/${pageId}/edit`}
                                                        className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#4e4f50] text-[15px]"
                                                    >
                                                        <Edit size={18} />
                                                        Chỉnh sửa thông tin page
                                                    </Link>
                                                    <button
                                                        onClick={() => setShowAddMemberModal(true)}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#4e4f50] text-[15px]"
                                                    >
                                                        <UserPlus size={18} />
                                                        Thêm thành viên
                                                    </button>
                                                </>
                                            )}
                                            {memberStatus === "owner" && (
                                                <>
                                                    <div className="border-t border-gray-200 dark:border-[#4e4f50] my-1" />
                                                    <button
                                                        onClick={handleDeletePage}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[15px]"
                                                    >
                                                        <Trash2 size={18} />
                                                        Xóa page
                                                    </button>
                                                </>
                                            )}
                                            {!isOwnerOrAdmin && (
                                                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#4e4f50] text-[15px]">
                                                    <Flag size={18} />
                                                    Báo cáo page
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-t border-gray-200 dark:border-[#3a3b3c] mt-2">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`relative flex items-center gap-2 px-4 py-3 text-[15px] font-semibold transition-colors border-b-[3px] -mb-px ${
                                        activeTab === tab.id
                                            ? "text-blue-500 border-blue-500"
                                            : "text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-t-lg"
                                    }`}
                                >
                                    {tab.label}
                                    {tab.badge ? (
                                        <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full font-bold">
                                            {tab.badge}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="max-w-[1095px] mx-auto px-4 md:px-6 py-4">

                {/* POSTS TAB */}
                {activeTab === "posts" && (
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Left sidebar */}
                        <div className="lg:w-[360px] flex-shrink-0 space-y-3">
                            {/* About card */}
                            <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm p-4">
                                <h3 className="text-xl font-bold dark:text-white mb-3">Giới thiệu</h3>
                                {page.description ? (
                                    <p className="text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed line-clamp-4">
                                        {page.description}
                                    </p>
                                ) : (
                                    <p className="text-gray-400 dark:text-gray-500 text-[15px] italic">Chưa có mô tả</p>
                                )}
                                <div className="mt-4 space-y-2.5">
                                    {page.category && (
                                        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 text-[15px]">
                                            <Flag size={18} className="text-gray-400 flex-shrink-0" />
                                            <span>{page.category}</span>
                                        </div>
                                    )}
                                    {page.phone && (
                                        <a href={`tel:${page.phone}`} className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-500 text-[15px]">
                                            <Phone size={18} className="text-gray-400 flex-shrink-0" />
                                            <span>{page.phone}</span>
                                        </a>
                                    )}
                                    {page.email && (
                                        <a href={`mailto:${page.email}`} className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-500 text-[15px]">
                                            <Mail size={18} className="text-gray-400 flex-shrink-0" />
                                            <span className="truncate">{page.email}</span>
                                        </a>
                                    )}
                                    {page.website && (
                                        <a href={page.website} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-3 text-blue-500 hover:underline text-[15px]">
                                            <LinkIcon size={18} className="flex-shrink-0" />
                                            <span className="truncate">{page.website}</span>
                                        </a>
                                    )}
                                    {page.address && (
                                        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 text-[15px]">
                                            <MapPin size={18} className="text-gray-400 flex-shrink-0" />
                                            <span>{page.address}</span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setActiveTab("about")}
                                    className="w-full mt-4 py-2 bg-gray-100 dark:bg-[#3a3b3c] text-gray-700 dark:text-gray-200 rounded-lg text-[15px] font-semibold hover:bg-gray-200 dark:hover:bg-[#4e4f50] transition-colors"
                                >
                                    Xem thêm
                                </button>
                            </div>

                            {/* Member Status badge */}
                            {memberStatus !== "none" && memberStatus !== "loading" && (
                                <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm p-4">
                                    <div className={`flex items-center gap-3 p-3 rounded-xl ${
                                        memberStatus === "owner" ? "bg-purple-50 dark:bg-purple-900/20" :
                                        memberStatus === "admin" ? "bg-blue-50 dark:bg-blue-900/20" :
                                        memberStatus === "blocked" ? "bg-red-50 dark:bg-red-900/20" :
                                        memberStatus === "pending" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                                        "bg-green-50 dark:bg-green-900/20"
                                    }`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            memberStatus === "owner" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600" :
                                            memberStatus === "admin" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" :
                                            memberStatus === "blocked" ? "bg-red-100 dark:bg-red-900/40 text-red-600" :
                                            memberStatus === "pending" ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600" :
                                            "bg-green-100 dark:bg-green-900/40 text-green-600"
                                        }`}>
                                            {memberStatus === "owner" ? <Settings size={20} /> :
                                             memberStatus === "admin" ? <Settings size={20} /> :
                                             memberStatus === "blocked" ? <XCircle size={20} /> :
                                             memberStatus === "pending" ? <Clock size={20} /> :
                                             <UserCheck size={20} />}
                                        </div>
                                        <div>
                                            <p className={`font-semibold text-[15px] ${
                                                memberStatus === "owner" ? "text-purple-700 dark:text-purple-400" :
                                                memberStatus === "admin" ? "text-blue-700 dark:text-blue-400" :
                                                memberStatus === "blocked" ? "text-red-700 dark:text-red-400" :
                                                memberStatus === "pending" ? "text-yellow-700 dark:text-yellow-400" :
                                                "text-green-700 dark:text-green-400"
                                            }`}>
                                                {memberStatus === "owner" ? "Chủ sở hữu" :
                                                 memberStatus === "admin" ? "Quản trị viên" :
                                                 memberStatus === "blocked" ? "Đã bị chặn" :
                                                 memberStatus === "pending" ? "Đang chờ duyệt" :
                                                 "Thành viên"}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {memberStatus === "owner" ? "Bạn quản lý page này" :
                                                 memberStatus === "admin" ? "Bạn có quyền quản trị" :
                                                 memberStatus === "blocked" ? "Bạn không thể tham gia" :
                                                 memberStatus === "pending" ? "Chờ admin duyệt" :
                                                 "Bạn là thành viên"}
                                            </p>
                                        </div>
                                    </div>
                                    {isOwnerOrAdmin && (
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                onClick={() => setShowAddMemberModal(true)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                                            >
                                                <UserPlus size={16} />
                                                Thêm thành viên
                                            </button>
                                            <Link
                                                to={`/pages/${pageId}/posts`}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 dark:bg-[#3a3b3c] text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                                            >
                                                <FileText size={16} />
                                                Quản lý bài
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Main feed */}
                        <div className="flex-1 min-w-0 space-y-3">
                            {loadingPosts ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                </div>
                            ) : posts.length === 0 ? (
                                <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm p-12 text-center">
                                    <div className="w-20 h-20 bg-gray-100 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileText size={36} className="text-gray-400" />
                                    </div>
                                    <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Chưa có bài viết nào
                                    </p>
                                    <p className="text-gray-400 dark:text-gray-500 text-[15px]">
                                        Các bài viết của page sẽ xuất hiện ở đây
                                    </p>
                                </div>
                            ) : (
                                posts.map((post) => (
                                    <PostCard
                                        key={post._id}
                                        post={post}
                                        page={page}
                                        isOwnerOrAdmin={isOwnerOrAdmin}
                                        postActionLoading={postActionLoading}
                                        onRemove={handleRemovePost}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ABOUT TAB */}
                {activeTab === "about" && (
                    <div className="max-w-2xl">
                        <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm p-6 space-y-6">
                            <h2 className="text-xl font-bold dark:text-white">Giới thiệu về page</h2>
                            {page.description && (
                                <div>
                                    <p className="text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed whitespace-pre-line">
                                        {page.description}
                                    </p>
                                </div>
                            )}
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 text-[15px] text-gray-600 dark:text-gray-300">
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center flex-shrink-0">
                                        {page.status === "PRIVATE" ? <Lock size={18} className="text-gray-500" /> : <Globe size={18} className="text-gray-500" />}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {page.status === "PRIVATE" ? "Nhóm riêng tư" : "Nhóm công khai"}
                                        </p>
                                        <p className="text-gray-500 text-sm">
                                            {page.status === "PRIVATE"
                                                ? "Chỉ thành viên mới thấy được bài viết và thành viên"
                                                : "Mọi người đều có thể thấy bài viết và thành viên"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-[15px] text-gray-600 dark:text-gray-300">
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center flex-shrink-0">
                                        <Users size={18} className="text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {memberCount.toLocaleString()} thành viên
                                        </p>
                                    </div>
                                </div>
                                {page.phone && (
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center flex-shrink-0">
                                            <Phone size={18} className="text-gray-500" />
                                        </div>
                                        <a href={`tel:${page.phone}`} className="text-blue-500 hover:underline text-[15px]">{page.phone}</a>
                                    </div>
                                )}
                                {page.email && (
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center flex-shrink-0">
                                            <Mail size={18} className="text-gray-500" />
                                        </div>
                                        <a href={`mailto:${page.email}`} className="text-blue-500 hover:underline text-[15px]">{page.email}</a>
                                    </div>
                                )}
                                {page.website && (
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center flex-shrink-0">
                                            <LinkIcon size={18} className="text-gray-500" />
                                        </div>
                                        <a href={page.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-[15px]">{page.website}</a>
                                    </div>
                                )}
                                {page.address && (
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-[#3a3b3c] rounded-full flex items-center justify-center flex-shrink-0">
                                            <MapPin size={18} className="text-gray-500" />
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 text-[15px]">{page.address}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* MEMBERS TAB */}
                {activeTab === "members" && isOwnerOrAdmin && (
                    <div className="max-w-2xl">
                        <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold dark:text-white">Thành viên · {members.length}</h2>
                                <button
                                    onClick={() => setShowAddMemberModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                                >
                                    <UserPlus size={16} />
                                    Thêm
                                </button>
                            </div>
                            <div className="space-y-2">
                                {members.length === 0 ? (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Chưa có thành viên</p>
                                ) : (
                                    members.map((member) => (
                                        <div key={member.userId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3b3c] transition-colors">
                                            <img
                                                src={"https://via.placeholder.com/40"}
                                                alt={`User ${member.userId}`}
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold dark:text-white text-[15px]">User #{member.userId}</p>
                                                <p className="text-gray-500 text-sm">{member.pageRole}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                member.pageRole === "ADMIN" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                                "bg-gray-100 text-gray-600 dark:bg-[#3a3b3c] dark:text-gray-400"
                                            }`}>
                                                {member.pageRole}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* PENDING TAB */}
                {activeTab === "pending" && isOwnerOrAdmin && (
                    <div className="max-w-2xl space-y-4">
                        {/* Join Requests */}
                        <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm p-6">
                            <h2 className="text-xl font-bold dark:text-white mb-1">
                                Yêu cầu tham gia
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                {pendingRequests.length} yêu cầu đang chờ
                            </p>
                            {loadingPendingRequests ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-blue-500" size={28} />
                                </div>
                            ) : pendingRequests.length === 0 ? (
                                <div className="text-center py-8">
                                    <UserCheck size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="text-gray-400 dark:text-gray-500">Không có yêu cầu nào</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingRequests.map((request) => (
                                        <div key={request.userId}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#3a3b3c]">
                                            <img
                                                src={buildS3Url(request.user?.avatarUrl) || "https://via.placeholder.com/48"}
                                                alt={request.user?.username}
                                                className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold dark:text-white text-[15px]">
                                                    {request.user?.name || request.user?.username || `User #${request.userId}`}
                                                </p>
                                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                                    @{request.user?.username}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                                                {requestActionLoading === request.userId ? (
                                                    <Loader2 className="animate-spin text-gray-400" size={20} />
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleApproveRequest(request.userId)}
                                                            className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                                                        >
                                                            Chấp nhận
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectRequest(request.userId)}
                                                            className="px-4 py-1.5 bg-gray-200 dark:bg-[#3a3b3c] text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-colors"
                                                        >
                                                            Từ chối
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pending Posts */}
                        {pendingPosts.length > 0 && (
                            <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm p-6">
                                <h2 className="text-xl font-bold dark:text-white mb-1">Bài viết chờ duyệt</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                                    {pendingPosts.length} bài đang chờ
                                </p>
                                <div className="space-y-3">
                                    {pendingPosts.map((post) => (
                                        <div key={post._id}
                                            className="p-4 border border-gray-200 dark:border-[#3a3b3c] rounded-xl">
                                            {post.content && (
                                                <p className="text-gray-700 dark:text-gray-300 text-[15px] leading-relaxed mb-3 line-clamp-3">
                                                    {post.content}
                                                </p>
                                            )}
                                            {post.images && post.images.length > 0 && (
                                                <div className={`grid gap-1.5 mb-3 ${
                                                    post.images.length === 1 ? 'grid-cols-1' :
                                                    post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                                                }`}>
                                                    {post.images.slice(0, 4).map((img, idx) => (
                                                        <img key={idx}
                                                            src={buildS3Url(img) || img}
                                                            alt=""
                                                            className="w-full h-24 object-cover rounded-lg"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                {postActionLoading === post._id ? (
                                                    <Loader2 className="animate-spin text-gray-400" size={18} />
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprovePost(post._id)}
                                                            className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                                                        >
                                                            Duyệt bài
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectPost(post._id)}
                                                            className="flex-1 py-2 bg-gray-200 dark:bg-[#3a3b3c] text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-colors"
                                                        >
                                                            Từ chối
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => {
                            setShowAddMemberModal(false);
                            setMemberSearchQuery("");
                            setSearchResults([]);
                            setSelectedUsers([]);
                        }}
                    />
                    <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#242526] rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#3a3b3c]">
                            <div>
                                <h2 className="text-xl font-bold dark:text-white">Thêm thành viên</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Tìm và thêm người vào page</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAddMemberModal(false);
                                    setMemberSearchQuery("");
                                    setSearchResults([]);
                                    setSelectedUsers([]);
                                }}
                                className="w-9 h-9 flex items-center justify-center bg-gray-100 dark:bg-[#3a3b3c] rounded-full hover:bg-gray-200 dark:hover:bg-[#4e4f50] transition-colors"
                            >
                                <X size={18} className="dark:text-white" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {/* Search input */}
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm theo username..."
                                    value={memberSearchQuery}
                                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-100 dark:bg-[#3a3b3c] border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-[15px]"
                                />
                            </div>

                            {isSearching && (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="animate-spin text-blue-500" size={24} />
                                </div>
                            )}

                            {!isSearching && searchResults.length > 0 && (
                                <div>
                                    <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                        Kết quả
                                    </p>
                                    <div className="space-y-1">
                                        {searchResults.map(user => {
                                            const isSelected = selectedUsers.some(u => u.id === user.id);
                                            return (
                                                <button
                                                    key={user.id}
                                                    onClick={() => toggleUserSelection(user)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                                                        isSelected
                                                            ? "bg-blue-50 dark:bg-blue-900/20"
                                                            : "hover:bg-gray-50 dark:hover:bg-[#3a3b3c]"
                                                    }`}
                                                >
                                                    <div className="relative flex-shrink-0">
                                                        <img
                                                            src={buildS3Url(user.avatarUrl) || "https://via.placeholder.com/44"}
                                                            alt={user.username}
                                                            className="w-11 h-11 rounded-full object-cover"
                                                        />
                                                        {isSelected && (
                                                            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-[#242526]">
                                                                <CheckCircle size={12} className="text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 text-left min-w-0">
                                                        <p className="font-semibold dark:text-white text-[15px] truncate">
                                                            {user.name || user.username}
                                                        </p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                        isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 dark:border-gray-600"
                                                    }`}>
                                                        {isSelected && <CheckCircle size={14} className="text-white" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {selectedUsers.length > 0 && (
                                <div>
                                    <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                        Đã chọn · {selectedUsers.length}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedUsers.map(user => (
                                            <div key={user.id}
                                                className="flex items-center gap-2 pl-1 pr-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                                                <img
                                                    src={buildS3Url(user.avatarUrl) || "https://via.placeholder.com/24"}
                                                    alt={user.username}
                                                    className="w-6 h-6 rounded-full object-cover"
                                                />
                                                <span className="text-sm font-medium">@{user.username}</span>
                                                <button
                                                    onClick={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))}
                                                    className="text-blue-500 hover:text-blue-700"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Role */}
                            <div>
                                <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Vai trò
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {PAGE_ROLES.map(role => (
                                        <button
                                            key={role.value}
                                            onClick={() => setSelectedRole(role.value)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                                                selectedRole === role.value
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-gray-100 dark:bg-[#3a3b3c] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#4e4f50]"
                                            }`}
                                        >
                                            {role.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-gray-200 dark:border-[#3a3b3c]">
                            <button
                                onClick={handleAddMembers}
                                disabled={selectedUsers.length === 0 || isAddingMembers}
                                className={`w-full py-3 rounded-xl text-[15px] font-bold transition-all ${
                                    selectedUsers.length === 0 || isAddingMembers
                                        ? "bg-gray-100 dark:bg-[#3a3b3c] text-gray-400 cursor-not-allowed"
                                        : "bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98]"
                                }`}
                            >
                                {isAddingMembers ? (
                                    <Loader2 className="animate-spin mx-auto" size={20} />
                                ) : (
                                    `Thêm ${selectedUsers.length > 0 ? selectedUsers.length + " " : ""}thành viên`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close more menu */}
            {showMoreMenu && (
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
            )}
        </div>
    );
}

// PostCard component
function PostCard({
    post,
    page,
    isOwnerOrAdmin,
    postActionLoading,
    onRemove,
}: {
    post: Post;
    page: Page;
    isOwnerOrAdmin: boolean;
    postActionLoading: string | null;
    onRemove: (id: string) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="bg-white dark:bg-[#242526] rounded-xl shadow-sm overflow-hidden">
            {/* Post Header */}
            <div className="flex items-start justify-between p-4 pb-3">
                <div className="flex items-center gap-3">
                    <img
                        src={buildS3Url(page.avatarUrl) || "https://via.placeholder.com/44"}
                        alt={page.name}
                        className="w-11 h-11 rounded-full object-cover"
                    />
                    <div>
                        <p className="font-semibold dark:text-white text-[15px] hover:underline cursor-pointer">
                            {page.name}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-[13px]">
                            {timeAgo(post.createdAt)}
                            <span className="ml-1">·</span>
                            <span className="ml-1"><Globe size={11} className="inline" /></span>
                        </p>
                    </div>
                </div>
                {isOwnerOrAdmin && (
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-full transition-colors"
                        >
                            <MoreHorizontal size={20} />
                        </button>
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                                <div className="absolute right-0 top-10 w-52 bg-white dark:bg-[#3a3b3c] rounded-xl shadow-xl border border-gray-200 dark:border-[#4e4f50] z-50 py-1 overflow-hidden">
                                    <button
                                        onClick={() => { onRemove(post._id); setShowMenu(false); }}
                                        disabled={postActionLoading === post._id}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[15px]"
                                    >
                                        <Trash2 size={18} />
                                        Xóa bài viết
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Post Content */}
            {post.content && (
                <div className="px-4 pb-3">
                    <p className="text-gray-800 dark:text-gray-200 text-[15px] leading-relaxed whitespace-pre-line">
                        {post.content}
                    </p>
                </div>
            )}

            {/* Post Images */}
            {post.images && post.images.length > 0 && (
                <div className={`grid gap-0.5 ${
                    post.images.length === 1 ? 'grid-cols-1' :
                    post.images.length === 2 ? 'grid-cols-2' :
                    post.images.length === 3 ? 'grid-cols-3' :
                    'grid-cols-2'
                }`}>
                    {post.images.slice(0, post.images.length === 4 ? 4 : 5).map((img, idx) => (
                        <div key={idx} className={`relative overflow-hidden bg-black ${
                            post.images!.length === 3 && idx === 0 ? 'col-span-2' : ''
                        }`}>
                            <img
                                src={buildS3Url(img) || img}
                                alt={`Post image ${idx + 1}`}
                                className={`w-full object-cover cursor-pointer hover:opacity-95 transition-opacity ${
                                    post.images!.length === 1 ? 'max-h-[500px]' :
                                    post.images!.length === 2 ? 'h-[300px]' : 'h-[200px]'
                                }`}
                            />
                            {idx === 4 && post.images!.length > 5 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer">
                                    <span className="text-white text-2xl font-bold">+{post.images!.length - 5}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Stats row */}
            {(post.likesCount || post.commentsCount) ? (
                <div className="flex items-center justify-between px-4 py-2 text-gray-500 dark:text-gray-400 text-[13px]">
                    {post.likesCount ? (
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <ThumbsUp size={12} className="text-white" />
                            </span>
                            <span>{post.likesCount.toLocaleString()}</span>
                        </div>
                    ) : <div />}
                    {post.commentsCount ? (
                        <span>{post.commentsCount.toLocaleString()} bình luận</span>
                    ) : null}
                </div>
            ) : null}

            {/* Action buttons */}
            <div className="flex border-t border-gray-100 dark:border-[#3a3b3c] mx-4 py-1">
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors text-[15px] font-semibold">
                    <ThumbsUp size={20} />
                    Thích
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors text-[15px] font-semibold">
                    <MessageCircle size={20} />
                    Bình luận
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3b3c] rounded-lg transition-colors text-[15px] font-semibold">
                    <Share2 size={20} />
                    Chia sẻ
                </button>
            </div>
        </div>
    );
}