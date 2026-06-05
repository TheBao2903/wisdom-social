import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import pageService from "@/services/pageService";
import { buildS3Url } from "@/utils/s3";
import userService from "@/services/userService";
import { usePageEvents } from "@/hooks/usePageEvents";
import { usePagePostEvents } from "@/hooks/usePagePostEvents";
import { usePageListUpdates } from "@/hooks/usePageListUpdates";
import type {
  PageData,
  PageRole,
  PageInteractionStatus,
  MemberStatus,
  PageMemberData,
  PagePostItem,
} from "@/services/pageService";
import type { User } from "@/services/userService";
import ReportModal from "@/components/ReportModal";

// ── Types ──────────────────────────────────────────────────────────────────

type PostItem = {
  id: string;
  content?: string;
  authorId?: string | number;
  createdAt?: string;
  media?: Array<{ url?: string; type?: string }>;
  stats?: { likes?: number; comments?: number };
};

type Section = "info" | "posts" | "members";

// ── Helpers ────────────────────────────────────────────────────────────────

const { width: screenWidth } = Dimensions.get("window");
const COVER_HEIGHT = 220;
const FB_BG = "#F0F2F5";
const FB_BLUE = colors.primary;

const MEMBER_ROLES: { label: string; value: PageRole }[] = [
  { label: "Admin", value: "ADMIN" },
  { label: "Moderator", value: "MODERATOR" },
  { label: "User", value: "USER" },
];

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(n);
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PageDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pageId } = useLocalSearchParams<{ pageId?: string }>();
  const { currentUser } = useAppContext();

  const numericUserId = useMemo(() => {
    const id = Number(currentUser?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [currentUser?.id]);

  const numericPageId = Number(pageId ?? 0);

  // ── Core state ─────────────────────────────────────────────────────────

  const [page, setPage] = useState<PageData | null>(null);
  const [members, setMembers] = useState<PageMemberData[]>([]);
  const [interaction, setInteraction] = useState<PageInteractionStatus>({
    isLiked: false,
    isFollowing: false,
    likeCount: 0,
    followCount: 0,
  });
  const [memberStatus, setMemberStatus] = useState<MemberStatus | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [userRole, setUserRole] = useState<PageRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Tabs ───────────────────────────────────────────────────────────────

  const [activeSection, setActiveSection] = useState<Section>("info");

  // ── Posts state ────────────────────────────────────────────────────────

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsWaiting, setPostsWaiting] = useState<PagePostItem[]>([]);
  const [loadingWaiting, setLoadingWaiting] = useState(false);
  const [myPendingPosts, setMyPendingPosts] = useState<PagePostItem[]>([]);
  const [loadingMyPending, setLoadingMyPending] = useState(false);
  const [withdrawingPostId, setWithdrawingPostId] = useState<string | null>(null);

  // ── Pending requests state ─────────────────────────────────────────────

  const [pendingRequests, setPendingRequests] = useState<PageMemberData[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // ── Create post modal ──────────────────────────────────────────────────

  const [showReportModal, setShowReportModal] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImages, setPostImages] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [creatingPost, setCreatingPost] = useState(false);

  // ── Add member modal ───────────────────────────────────────────────────

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<User[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [newMemberRole, setNewMemberRole] = useState<PageRole>("USER");
  const [addingMembers, setAddingMembers] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────

  const isAdmin = userRole === "ADMIN";
  const isMod = userRole === "MODERATOR";
  const canManage = isAdmin || isMod;
  const isOwner = !!(
    page &&
    numericUserId &&
    Number(page.createdBy?.id) === numericUserId
  );

  // ── Data loading ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!numericPageId) return;
    try {
      const [pageData, interactionData, count, membersData] = await Promise.all(
        [
          pageService.findPageById(numericPageId),
          pageService.getPageInteractionStatus(numericPageId),
          pageService.getMemberCount(numericPageId),
          pageService.getPageMembers(numericPageId),
        ],
      );
      setPage(pageData);
      setInteraction(interactionData);
      setMemberCount(count);
      setMembers(membersData);

      if (numericUserId) {
        const status = await pageService.getMemberStatus(
          numericPageId,
          numericUserId,
        );
        setMemberStatus(status);
        if (status === "ACTIVE") {
          const me = membersData.find((m) => m.user?.id === numericUserId);
          setUserRole(me?.role ?? "USER");
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [numericPageId, numericUserId]);

  const loadPosts = useCallback(async () => {
    if (!numericPageId) return;
    setLoadingPosts(true);
    try {
      const data = await pageService.getAllPostsOfPage(numericPageId);
      setPosts(data);
    } finally {
      setLoadingPosts(false);
    }
  }, [numericPageId]);

  const loadWaiting = useCallback(async () => {
    if (!numericPageId) return;
    setLoadingWaiting(true);
    try {
      const data = await pageService.getPostsWaitingForApproval(numericPageId);
      setPostsWaiting(data);
    } finally {
      setLoadingWaiting(false);
    }
  }, [numericPageId]);

  const loadPending = useCallback(async () => {
    if (!numericPageId) return;
    setLoadingPending(true);
    try {
      const data = await pageService.getPendingJoinRequests(numericPageId);
      setPendingRequests(data);
    } finally {
      setLoadingPending(false);
    }
  }, [numericPageId]);

  const loadMyPending = useCallback(async () => {
    if (!numericPageId) return;
    setLoadingMyPending(true);
    try {
      const data = await pageService.getMyPendingPosts(numericPageId);
      setMyPendingPosts(data);
    } finally {
      setLoadingMyPending(false);
    }
  }, [numericPageId]);

  useEffect(() => { void load(); }, [load]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!page || !canManage) return;
    void loadWaiting();
    if (isAdmin || isOwner) void loadPending();
  }, [page?.id, canManage, isAdmin, isOwner]);

  useEffect(() => {
    if (memberStatus === "ACTIVE" && !canManage) {
      void loadMyPending();
    }
  }, [memberStatus, canManage, loadMyPending]);

  useEffect(() => {
    if (activeSection === "posts") void loadPosts();
  }, [activeSection, loadPosts]);

  const wsRefresh = usePageEvents({
    pageId: numericPageId || undefined,
    userId: numericUserId ?? undefined,
    onEvent: (event) => {
      const type = event.eventType;
      if (type === "PAGE_MEMBER_JOINED" || type === "PAGE_MEMBER_LEFT") {
        setMemberCount(c => type === "PAGE_MEMBER_JOINED" ? c + 1 : Math.max(0, c - 1));
        if (type === "PAGE_MEMBER_LEFT" && event.userId) {
          setMembers(prev => prev.filter(m => m.user?.id !== event.userId));
        }
      }
    }
  });

  useEffect(() => {
    if (wsRefresh > 0) {
      const timer = setTimeout(() => {
        void load();
        void loadPending();
        void loadWaiting();
        if (memberStatus === "ACTIVE" && !canManage) void loadMyPending();
        if (activeSection === "posts") void loadPosts();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [wsRefresh, load, loadPending, loadWaiting, loadPosts, loadMyPending, activeSection, memberStatus, canManage]);

  usePagePostEvents({
    pageId: numericPageId || undefined,
    onPostSubmitted: (_postId, post) => {
      if (post && canManage) {
        const newPost = post as unknown as PagePostItem;
        setPostsWaiting(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev;
          return [newPost, ...prev];
        });
      }
      if (post && memberStatus === "ACTIVE" && !canManage) {
        const postAuthorId = (post as any).authorId;
        const myId = numericUserId ? String(numericUserId) : null;
        if (myId && postAuthorId === myId) {
          const newPost = post as unknown as PagePostItem;
          setMyPendingPosts(prev => {
            if (prev.some(p => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        }
      }
    },
    onPostApproved: (postId, post) => {
      setPostsWaiting(prev => prev.filter(p => p.id !== postId));
      setMyPendingPosts(prev => prev.filter(p => p.id !== postId));
      if (post) {
        const approvedPost = post as unknown as PostItem;
        setPosts(prev => {
          if (prev.some(p => p.id === postId)) return prev;
          return [approvedPost, ...prev];
        });
      }
    },
    onPostRejected: (postId) => {
      setPostsWaiting(prev => prev.filter(p => p.id !== postId));
      setMyPendingPosts(prev => prev.filter(p => p.id !== postId));
    },
    onPostRemoved: (postId) => {
      setPosts(prev => prev.filter(p => p.id !== postId));
      setMyPendingPosts(prev => prev.filter(p => p.id !== postId));
      setPostsWaiting(prev => prev.filter(p => p.id !== postId));
    },
  });

  usePageListUpdates({
    pageId: numericPageId > 0 ? numericPageId : undefined,
    onPageUpdated: () => { void load(); },
    onPageDeleted: () => {
      Alert.alert("Trang đã bị xóa", "", [{ text: "Quay lại", onPress: () => router.back() }], { cancelable: false });
    },
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
    void loadPending();
    void loadWaiting();
    if (memberStatus === "ACTIVE" && !canManage) void loadMyPending();
    if (activeSection === "posts") void loadPosts();
  }, [load, loadPending, loadWaiting, loadPosts, loadMyPending, activeSection, memberStatus, canManage]);

  const handleWithdrawPost = (postId: string) => {
    if (!numericUserId) return;
    Alert.alert("Rút bài viết", "Bài viết sẽ bị xóa hoàn toàn. Bạn có chắc muốn rút bài này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rút bài",
        style: "destructive",
        onPress: async () => {
          setWithdrawingPostId(postId);
          try {
            const ok = await pageService.removePostFromPage(numericUserId, numericPageId, postId);
            if (ok) {
              setMyPendingPosts(prev => prev.filter(p => p.id !== postId));
            } else {
              Alert.alert("Lỗi", "Không thể rút bài. Vui lòng thử lại.");
            }
          } catch {
            Alert.alert("Lỗi", "Không thể rút bài.");
          } finally {
            setWithdrawingPostId(null);
          }
        },
      },
    ]);
  };

  // ── User search for add member ─────────────────────────────────────────

  useEffect(() => {
    if (!memberQuery || memberQuery.length < 2) {
      setMemberSearchResults([]);
      return;
    }
    setMemberSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await userService.searchUserByUsername(memberQuery);
        if (Array.isArray(results)) {
          const memberIds = members.map(m => m.user?.id);
          setMemberSearchResults(results.filter(u => !memberIds.includes(Number(u.id))));
        } else {
          setMemberSearchResults([]);
        }
      } catch {
        setMemberSearchResults([]);
      } finally {
        setMemberSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [memberQuery, members]);

  // ── Like / Follow ──────────────────────────────────────────────────────

  const toggleLike = async () => {
    if (!numericUserId) return;
    setActionLoading(true);
    try {
      if (interaction.isLiked) {
        await pageService.cancelLikePage(numericUserId, numericPageId);
        setInteraction(s => ({ ...s, isLiked: false, likeCount: Math.max(0, s.likeCount - 1) }));
      } else {
        await pageService.likePage(numericUserId, numericPageId);
        setInteraction(s => ({ ...s, isLiked: true, likeCount: s.likeCount + 1 }));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!numericUserId) return;
    setActionLoading(true);
    try {
      if (interaction.isFollowing) {
        await pageService.cancelFollowPage(numericUserId, numericPageId);
        setInteraction(s => ({ ...s, isFollowing: false, followCount: Math.max(0, s.followCount - 1) }));
      } else {
        await pageService.followPage(numericUserId, numericPageId);
        setInteraction(s => ({ ...s, isFollowing: true, followCount: s.followCount + 1 }));
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Join / Leave ───────────────────────────────────────────────────────

  const handleJoin = async () => {
    if (!numericUserId) return;
    setActionLoading(true);
    try {
      await pageService.requestJoinPage(numericUserId, numericPageId);
      const status = await pageService.getMemberStatus(numericPageId, numericUserId);
      setMemberStatus(status);
      if (status === "ACTIVE") setMemberCount(c => c + 1);

      // Tham gia trang -> tự động thích + theo dõi (nếu chưa).
      if (!interaction.isLiked) {
        try {
          await pageService.likePage(numericUserId, numericPageId);
          setInteraction(s => ({ ...s, isLiked: true, likeCount: s.likeCount + 1 }));
        } catch { /* bỏ qua nếu like lỗi */ }
      }
      if (!interaction.isFollowing) {
        try {
          await pageService.followPage(numericUserId, numericPageId);
          setInteraction(s => ({ ...s, isFollowing: true, followCount: s.followCount + 1 }));
        } catch { /* bỏ qua nếu follow lỗi */ }
      }

      Alert.alert("Thành công", page?.status === "PUBLIC" ? "Đã tham gia trang." : "Đã gửi yêu cầu tham gia.");
    } catch {
      Alert.alert("Lỗi", "Không thể gửi yêu cầu.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = () => {
    if (!numericUserId) return;
    Alert.alert("Hủy yêu cầu", "Bạn muốn hủy yêu cầu tham gia trang?", [
      { text: "Không", style: "cancel" },
      {
        text: "Hủy yêu cầu",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            await pageService.cancelJoinRequest(numericPageId, numericUserId);
            setMemberStatus(null);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    if (!numericUserId) return;
    Alert.alert("Rời khỏi trang", "Bạn có chắc muốn rời khỏi trang này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rời",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            await pageService.removeMember(numericPageId, numericUserId);
            setMemberStatus(null);
            setUserRole(null);
            setMemberCount(c => Math.max(0, c - 1));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // ── Post actions ───────────────────────────────────────────────────────

  const handleApprovePost = async (postId: string) => {
    if (!numericUserId) return;
    try {
      await pageService.approvePost(numericUserId, numericPageId, postId);
      void loadWaiting();
    } catch {
      Alert.alert("Lỗi", "Không thể duyệt bài viết.");
    }
  };

  const handleCancelApprovePost = async (postId: string) => {
    if (!numericUserId) return;
    try {
      await pageService.cancelApprovePost(numericUserId, numericPageId, postId);
      void loadWaiting();
    } catch {
      Alert.alert("Lỗi", "Không thể hủy duyệt bài viết.");
    }
  };

  const handleRemovePost = (postId: string) => {
    if (!numericUserId) return;
    Alert.alert("Xóa bài viết", "Xóa bài viết này khỏi trang?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await pageService.removePostFromPage(numericUserId, numericPageId, postId);
            void loadPosts();
            void loadWaiting();
          } catch {
            Alert.alert("Lỗi", "Không thể xóa bài viết.");
          }
        },
      },
    ]);
  };

  const handleApproveAll = () => {
    if (!numericUserId) return;
    Alert.alert("Duyệt tất cả", "Duyệt tất cả bài viết đang chờ?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Duyệt",
        onPress: async () => {
          try {
            await pageService.approveAllPosts(numericUserId, numericPageId);
            void loadWaiting();
          } catch {
            Alert.alert("Lỗi", "Không thể duyệt tất cả.");
          }
        },
      },
    ]);
  };

  const handleCancelAll = () => {
    if (!numericUserId) return;
    Alert.alert("Hủy tất cả", "Hủy duyệt tất cả bài viết?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Hủy duyệt",
        style: "destructive",
        onPress: async () => {
          try {
            await pageService.cancelAllPosts(numericUserId, numericPageId);
            void loadWaiting();
          } catch {
            Alert.alert("Lỗi", "Không thể hủy duyệt.");
          }
        },
      },
    ]);
  };

  const handleCreatePost = async () => {
    if (!numericUserId || !numericPageId) return;
    if (!postContent.trim() && postImages.length === 0) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập nội dung hoặc chọn hình ảnh.");
      return;
    }
    setCreatingPost(true);
    try {
      const ok = await pageService.addPostToPage(
        numericPageId,
        { content: postContent },
        postImages.length > 0 ? postImages : undefined,
      );
      if (ok) {
        Alert.alert("Thành công", "Đã tạo bài viết.");
        setShowCreatePost(false);
        setPostContent("");
        setPostImages([]);
        void loadWaiting();
        if (activeSection === "posts") void loadPosts();
      } else {
        Alert.alert("Lỗi", "Không thể tạo bài viết.");
      }
    } catch {
      Alert.alert("Lỗi", "Không thể tạo bài viết.");
    } finally {
      setCreatingPost(false);
    }
  };

  const pickPostImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset, idx) => ({
        uri: asset.uri,
        name: `post_${Date.now()}_${idx}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      }));
      setPostImages(prev => [...prev, ...newImages]);
    }
  };

  // ── Member actions ─────────────────────────────────────────────────────

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert("Lỗi", "Vui lòng chọn ít nhất một người dùng.");
      return;
    }
    setAddingMembers(true);
    try {
      await Promise.all(selectedUsers.map(u => pageService.addMember(Number(u.id), numericPageId, newMemberRole)));
      Alert.alert("Thành công", `Đã thêm ${selectedUsers.length} thành viên.`);
      setShowAddMember(false);
      setMemberQuery("");
      setSelectedUsers([]);
      void load();
    } catch {
      Alert.alert("Lỗi", "Không thể thêm thành viên.");
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = (userId: number, name: string) => {
    Alert.alert("Xóa thành viên", `Xóa ${name} khỏi trang?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await pageService.removeMember(numericPageId, userId);
            setMembers(prev => prev.filter(m => m.user?.id !== userId));
            setMemberCount(prev => Math.max(0, prev - 1));
          } catch {
            Alert.alert("Lỗi", "Không thể xóa thành viên.");
          }
        },
      },
    ]);
  };

  const handlePromoteToAdmin = async (userId: number, name: string) => {
    Alert.alert("Thăng cấp Admin", `Thăng ${name} lên Admin?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Thăng cấp",
        onPress: async () => {
          setMemberActionLoading(userId);
          try {
            await pageService.authorizeMember(userId, numericPageId, "ADMIN");
            setMembers(prev => prev.map(m => m.user?.id === userId ? { ...m, role: "ADMIN" } : m));
          } catch {
            Alert.alert("Lỗi", "Không thể thăng cấp thành viên.");
          } finally {
            setMemberActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleDemoteToMember = async (userId: number, name: string) => {
    Alert.alert("Hạ cấp", `Hạ ${name} xuống Thành viên?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Hạ cấp",
        style: "destructive",
        onPress: async () => {
          setMemberActionLoading(userId);
          try {
            await pageService.authorizeMember(userId, numericPageId, "USER");
            setMembers(prev => prev.map(m => m.user?.id === userId ? { ...m, role: "USER" } : m));
          } catch {
            Alert.alert("Lỗi", "Không thể hạ cấp thành viên.");
          } finally {
            setMemberActionLoading(null);
          }
        },
      },
    ]);
  };

  // ── Join request actions ───────────────────────────────────────────────

  const handleApproveJoinRequest = (userId: number, name: string) => {
    Alert.alert("Duyệt yêu cầu", `Chấp nhận ${name} vào trang?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Duyệt",
        onPress: async () => {
          try {
            await pageService.approveJoinRequest(numericPageId, userId);
            void loadPending();
            void load();
          } catch {
            Alert.alert("Lỗi", "Không thể duyệt yêu cầu.");
          }
        },
      },
    ]);
  };

  const handleRejectJoinRequest = (userId: number, name: string) => {
    Alert.alert("Từ chối yêu cầu", `Từ chối ${name}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Từ chối",
        style: "destructive",
        onPress: async () => {
          try {
            await pageService.rejectJoinRequest(numericPageId, userId);
            void loadPending();
          } catch {
            Alert.alert("Lỗi", "Không thể từ chối.");
          }
        },
      },
    ]);
  };

  // ── Delete page ────────────────────────────────────────────────────────

  const handleDeletePage = () => {
    Alert.alert("Xóa trang", "Bạn có chắc muốn xóa trang này? Hành động không thể hoàn tác.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa trang",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            const ok = await pageService.deletePage(numericPageId);
            if (ok) router.back();
            else Alert.alert("Lỗi", "Không thể xóa trang.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // ── Join button ────────────────────────────────────────────────────────

  const renderJoinButton = () => {
    if (!numericUserId || isOwner) return null;
    if (memberStatus === "ACTIVE") {
      return (
        <TouchableOpacity style={[st.actionBtn, st.activeGreenBtn]} onPress={handleLeave} disabled={actionLoading}>
          <Ionicons name="checkmark-circle" size={16} color={colors.white} />
          <Text style={[st.actionBtnText, { color: colors.white }]}>Thành viên</Text>
        </TouchableOpacity>
      );
    }
    if (memberStatus === "PENDING") {
      return (
        <TouchableOpacity style={[st.actionBtn, st.pendingBtn]} onPress={handleCancelRequest} disabled={actionLoading}>
          <Ionicons name="time-outline" size={16} color="#92400E" />
          <Text style={[st.actionBtnText, { color: "#92400E" }]}>Hủy yêu cầu</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={[st.actionBtn, st.joinBtn]} onPress={handleJoin} disabled={actionLoading}>
        <Ionicons name="person-add-outline" size={16} color={colors.white} />
        <Text style={[st.actionBtnText, { color: colors.white }]}>
          {page?.status === "PUBLIC" ? "Tham gia" : "Xin tham gia"}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Loading / Error ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={st.loadingCover}>
          <LinearGradient colors={["#0068FF", "#00A2FF"]} style={StyleSheet.absoluteFill} />
          <TouchableOpacity onPress={() => router.back()} style={[st.coverBackBtn, { top: 12 }]}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        <View style={st.center}>
          <ActivityIndicator size="large" color={FB_BLUE} />
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  if (!page) {
    return (
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={st.loadingCover}>
          <LinearGradient colors={["#0068FF", "#00A2FF"]} style={StyleSheet.absoluteFill} />
          <TouchableOpacity onPress={() => router.back()} style={[st.coverBackBtn, { top: 12 }]}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        <View style={st.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15 }}>Không tìm thấy trang</Text>
          <TouchableOpacity onPress={() => router.back()} style={st.backLinkBtn}>
            <Text style={{ color: FB_BLUE, fontWeight: "700" }}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const coverUri = page.coverUrl ? `${buildS3Url(page.coverUrl)}?t=${page.updatedAt}` : null;
  const avatarUri = page.avatarUrl ? `${buildS3Url(page.avatarUrl)}?t=${page.updatedAt}` : null;

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FB_BLUE} />}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* ── Hero: Cover + Avatar ── */}
        <View style={st.heroSection}>
          {/* Cover */}
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={st.cover} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#0068FF", "#00A2FF"]} style={st.cover} />
          )}

          {/* Gradient overlay on cover */}
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "transparent", "transparent"]}
            style={st.coverGradient}
          />

          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} style={st.coverBackBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </TouchableOpacity>

          {/* Edit/More button (top-right) */}
          {(isOwner || isAdmin) ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(stack)/page-edit", params: { pageId: String(numericPageId) } })}
              style={st.coverEditBtn}
            >
              <Ionicons name="pencil" size={16} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowReportModal(true)}
              style={st.coverEditBtn}
            >
              <Ionicons name="flag-outline" size={16} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Profile Card ── */}
        <View style={st.profileCard}>
          {/* Avatar row */}
          <View style={st.avatarRow}>
            <View style={st.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={st.avatar} />
              ) : (
                <View style={[st.avatar, st.avatarFallback]}>
                  <Ionicons name="business-outline" size={40} color={FB_BLUE} />
                </View>
              )}
            </View>
          </View>

          {/* Page name + meta */}
          <View style={st.nameSection}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={st.pageName}>{page.name}</Text>
              {page.isVerified && (
                <Ionicons name="checkmark-circle" size={20} color={FB_BLUE} />
              )}
            </View>
            {!!page.username && (
              <Text style={st.pageHandle}>@{page.username}</Text>
            )}
            {!!page.category && (
              <View style={st.categoryChip}>
                <Text style={st.categoryText}>{page.category}</Text>
              </View>
            )}

            {/* Status + member count inline */}
            <View style={st.metaLine}>
              <Ionicons
                name={page.status === "PUBLIC" ? "earth-outline" : "lock-closed-outline"}
                size={13}
                color={colors.textMuted}
              />
              <Text style={st.metaText}>
                {page.status === "PUBLIC" ? "Công khai" : "Riêng tư"}
                {" · "}
                {memberCount.toLocaleString()} thành viên
              </Text>
            </View>

            {/* Description */}
            {!!page.description && (
              <Text style={st.description} numberOfLines={3}>{page.description}</Text>
            )}
          </View>

          {/* Stats row */}
          <View style={st.statsRow}>
            <View style={st.statItem}>
              <Text style={st.statNumber}>{fmtCount(interaction.likeCount)}</Text>
              <Text style={st.statLabel}>Thích</Text>
            </View>
            <View style={st.statSep} />
            <View style={st.statItem}>
              <Text style={st.statNumber}>{fmtCount(interaction.followCount)}</Text>
              <Text style={st.statLabel}>Theo dõi</Text>
            </View>
            <View style={st.statSep} />
            <View style={st.statItem}>
              <Text style={st.statNumber}>{fmtCount(memberCount)}</Text>
              <Text style={st.statLabel}>Thành viên</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={st.actionsRow}>
            {/* Like button */}
            <TouchableOpacity
              style={[st.actionBtn, interaction.isLiked ? st.activePrimaryBtn : st.outlineBtn]}
              onPress={toggleLike}
              disabled={actionLoading}
            >
              <Ionicons
                name={interaction.isLiked ? "thumbs-up" : "thumbs-up-outline"}
                size={16}
                color={interaction.isLiked ? colors.white : colors.text}
              />
              <Text style={[st.actionBtnText, { color: interaction.isLiked ? colors.white : colors.text }]}>
                {interaction.isLiked ? "Đã thích" : "Thích"}
              </Text>
            </TouchableOpacity>

            {/* Follow button */}
            <TouchableOpacity
              style={[st.actionBtn, interaction.isFollowing ? st.activePrimaryBtn : st.outlineBtn]}
              onPress={toggleFollow}
              disabled={actionLoading}
            >
              <Ionicons
                name={interaction.isFollowing ? "notifications" : "notifications-outline"}
                size={16}
                color={interaction.isFollowing ? colors.white : colors.text}
              />
              <Text style={[st.actionBtnText, { color: interaction.isFollowing ? colors.white : colors.text }]}>
                {interaction.isFollowing ? "Đang theo dõi" : "Theo dõi"}
              </Text>
            </TouchableOpacity>

            {/* Join/Member button */}
            {renderJoinButton()}

            {/* Post button for members */}
            {(memberStatus === "ACTIVE" || canManage || isOwner) && (
              <TouchableOpacity
                style={[st.actionBtn, st.outlineBtn]}
                onPress={() => setShowCreatePost(true)}
              >
                <Ionicons name="create-outline" size={16} color={colors.text} />
                <Text style={[st.actionBtnText, { color: colors.text }]}>Đăng bài</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={st.tabBar}>
          {(["info", "posts", "members"] as Section[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[st.tab, activeSection === tab && st.tabActive]}
              onPress={() => setActiveSection(tab)}
            >
              <Text style={[st.tabText, activeSection === tab && st.tabTextActive]}>
                {tab === "info" ? "Giới thiệu" : tab === "posts" ? "Bài viết" : `Thành viên (${members.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Info tab ── */}
        {activeSection === "info" && (
          <View style={st.tabContent}>
            {/* Contact card */}
            {(page.email || page.phone || page.website || page.address) && (
              <View style={st.card}>
                <Text style={st.cardTitle}>Thông tin liên hệ</Text>
                {!!page.phone && <InfoRow icon="call-outline" label="Điện thoại" value={page.phone} />}
                {!!page.email && <InfoRow icon="mail-outline" label="Email" value={page.email} />}
                {!!page.website && <InfoRow icon="globe-outline" label="Website" value={page.website} />}
                {!!page.address && <InfoRow icon="location-outline" label="Địa chỉ" value={page.address} />}
              </View>
            )}

            {/* Creator card */}
            {!!page.createdBy && (
              <View style={st.card}>
                <Text style={st.cardTitle}>Người tạo</Text>
                <View style={st.ownerRow}>
                  {page.createdBy.avatarUrl ? (
                    <Image source={{ uri: buildS3Url(page.createdBy.avatarUrl) }} style={st.ownerAvatar} />
                  ) : (
                    <View style={[st.ownerAvatar, st.avatarFallback]}>
                      <Ionicons name="person" size={16} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={st.ownerName}>
                      {page.createdBy.name || page.createdBy.username || page.createdBy.phone || "Không rõ"}
                    </Text>
                    {page.createdBy.username && (
                      <Text style={st.ownerSub}>@{page.createdBy.username}</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Management card */}
            {(canManage || isOwner) && (
              <View style={st.card}>
                <Text style={st.cardTitle}>Quản lý trang</Text>
                <ManageRow icon="create-outline" label="Tạo bài viết" color={FB_BLUE} onPress={() => setShowCreatePost(true)} />
                {(isAdmin || isOwner) && (
                  <ManageRow
                    icon="person-add-outline"
                    label="Thêm thành viên"
                    color={FB_BLUE}
                    onPress={() => { setMemberQuery(""); setSelectedUsers([]); setShowAddMember(true); }}
                  />
                )}
                {(isAdmin || isOwner) && (
                  <ManageRow
                    icon="settings-outline"
                    label="Chỉnh sửa trang"
                    color={FB_BLUE}
                    onPress={() => router.push({ pathname: "/(stack)/page-edit", params: { pageId: String(numericPageId) } })}
                  />
                )}
                {isOwner && (
                  <ManageRow icon="trash-outline" label="Xóa trang" color={colors.danger} onPress={handleDeletePage} last />
                )}
              </View>
            )}

            {/* Pending join requests */}
            {(isAdmin || isOwner) && pendingRequests.length > 0 && (
              <View style={st.card}>
                <Text style={st.cardTitle}>Yêu cầu tham gia ({pendingRequests.length})</Text>
                {loadingPending ? (
                  <ActivityIndicator size="small" color={FB_BLUE} />
                ) : (
                  pendingRequests.map(req => (
                    <View key={req.id} style={st.requestRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
                        {req.user?.avatarUrl ? (
                          <Image source={{ uri: buildS3Url(req.user.avatarUrl) }} style={st.reqAvatar} />
                        ) : (
                          <View style={[st.reqAvatar, st.avatarFallback]}>
                            <Ionicons name="person" size={14} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={st.memberName}>{req.user?.name || req.user?.username || "Người dùng"}</Text>
                          <Text style={st.memberSub}>@{req.user?.username || "unknown"}</Text>
                          {req.joinedAt && (
                            <Text style={st.memberSub}>{new Date(req.joinedAt).toLocaleDateString("vi-VN")}</Text>
                          )}
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={[st.smallBtn, { backgroundColor: "#D1FAE5" }]}
                          onPress={() => handleApproveJoinRequest(req.user?.id ?? 0, req.user?.name || req.user?.username || "người dùng")}
                        >
                          <Ionicons name="checkmark" size={14} color={colors.success} />
                          <Text style={[st.smallBtnText, { color: colors.success }]}>Duyệt</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[st.smallBtn, { backgroundColor: "#FEE2E2" }]}
                          onPress={() => handleRejectJoinRequest(req.user?.id ?? 0, req.user?.name || req.user?.username || "người dùng")}
                        >
                          <Ionicons name="close" size={14} color={colors.danger} />
                          <Text style={[st.smallBtnText, { color: colors.danger }]}>Từ chối</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Waiting posts */}
            {canManage && (postsWaiting.length > 0 || loadingWaiting) && (
              <View style={st.card}>
                <View style={st.cardHeaderRow}>
                  <Text style={st.cardTitle}>Bài viết chờ duyệt ({postsWaiting.length})</Text>
                  <TouchableOpacity onPress={() => setShowCreatePost(true)} hitSlop={8}>
                    <Ionicons name="add-circle" size={22} color={FB_BLUE} />
                  </TouchableOpacity>
                </View>
                {postsWaiting.length > 0 && (
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity style={[st.bulkBtn, { backgroundColor: "#D1FAE5" }]} onPress={handleApproveAll}>
                      <Ionicons name="checkmark-done" size={14} color={colors.success} />
                      <Text style={[st.bulkBtnText, { color: colors.success }]}>Duyệt tất cả</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.bulkBtn, { backgroundColor: "#FEE2E2" }]} onPress={handleCancelAll}>
                      <Ionicons name="close" size={14} color={colors.danger} />
                      <Text style={[st.bulkBtnText, { color: colors.danger }]}>Hủy tất cả</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {loadingWaiting ? (
                  <ActivityIndicator size="small" color={FB_BLUE} />
                ) : (
                  postsWaiting.map(post => (
                    <View key={post.id} style={[st.pendingPostCard, { borderColor: "#FCD34D" }]}>
                      <View style={st.postHeader}>
                        {post.user?.avatarUrl ? (
                          <Image source={{ uri: buildS3Url(post.user.avatarUrl) }} style={st.postAvatar} />
                        ) : (
                          <View style={[st.postAvatar, st.avatarFallback]}>
                            <Ionicons name="person" size={12} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={st.postAuthor}>{post.user?.name || post.user?.username || "Người dùng"}</Text>
                          <Text style={st.postDate}>{post.createdAt ? timeAgo(post.createdAt) : ""}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemovePost(post.id)} hitSlop={8}>
                          <Ionicons name="close" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                      {!!post.content && <Text style={st.postContent}>{post.content}</Text>}
                      {post.images && post.images.length > 0 && (
                        <Image source={{ uri: buildS3Url(post.images[0]) }} style={st.postImagePreview} resizeMode="cover" />
                      )}
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <TouchableOpacity style={[st.smallBtn, { flex: 1, backgroundColor: "#D1FAE5" }]} onPress={() => handleApprovePost(post.id)}>
                          <Ionicons name="checkmark" size={14} color={colors.success} />
                          <Text style={[st.smallBtnText, { color: colors.success }]}>Duyệt</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[st.smallBtn, { flex: 1, backgroundColor: "#FEE2E2" }]} onPress={() => handleCancelApprovePost(post.id)}>
                          <Ionicons name="close" size={14} color={colors.danger} />
                          <Text style={[st.smallBtnText, { color: colors.danger }]}>Hủy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* My pending posts */}
            {memberStatus === "ACTIVE" && !canManage && (
              <View style={st.card}>
                <View style={st.cardHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="time-outline" size={18} color="#D97706" />
                    <Text style={st.cardTitle}>Bài của tôi đang chờ duyệt</Text>
                  </View>
                  {myPendingPosts.length > 0 && (
                    <View style={{ backgroundColor: "#F59E0B", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{myPendingPosts.length}</Text>
                    </View>
                  )}
                </View>
                {loadingMyPending ? (
                  <ActivityIndicator size="small" color="#F59E0B" style={{ marginVertical: 12 }} />
                ) : myPendingPosts.length === 0 ? (
                  <View style={st.emptyBlock}>
                    <Ionicons name="checkmark-circle-outline" size={32} color={colors.border} />
                    <Text style={st.emptyText}>Không có bài nào đang chờ duyệt</Text>
                  </View>
                ) : (
                  myPendingPosts.map(post => (
                    <View key={post.id} style={[st.pendingPostCard, { borderColor: "#FDE68A" }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF3C7", padding: 8, borderRadius: 8, marginBottom: 8 }}>
                        <Ionicons name="time-outline" size={14} color="#D97706" />
                        <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "600", flex: 1 }}>Đang chờ admin duyệt</Text>
                        {post.createdAt && (
                          <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{timeAgo(post.createdAt)}</Text>
                        )}
                      </View>
                      {!!post.content && <Text style={st.postContent}>{post.content}</Text>}
                      {post.images && post.images.length > 0 && (
                        <Image source={{ uri: buildS3Url(post.images[0]) }} style={st.postImagePreview} resizeMode="cover" />
                      )}
                      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }}>
                        {withdrawingPostId === post.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <TouchableOpacity style={[st.smallBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => handleWithdrawPost(post.id)}>
                            <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                            <Text style={[st.smallBtnText, { color: colors.danger }]}>Rút bài</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Posts tab ── */}
        {activeSection === "posts" && (
          <View style={st.tabContent}>
            {/* Create post prompt */}
            {(memberStatus === "ACTIVE" || canManage || isOwner) && (
              <TouchableOpacity style={st.createPostPrompt} onPress={() => setShowCreatePost(true)}>
                <View style={[st.promptAvatar, st.avatarFallback]}>
                  <Ionicons name="person" size={14} color={colors.textMuted} />
                </View>
                <View style={st.promptInput}>
                  <Text style={st.promptText}>Bạn đang nghĩ gì?</Text>
                </View>
              </TouchableOpacity>
            )}

            {loadingPosts ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator size="large" color={FB_BLUE} />
              </View>
            ) : posts.length === 0 ? (
              <View style={st.emptyBlock}>
                <Ionicons name="newspaper-outline" size={48} color={colors.border} />
                <Text style={[st.emptyText, { marginTop: 12, fontSize: 15 }]}>Chưa có bài viết nào</Text>
              </View>
            ) : (
              posts.map(post => (
                <View key={post.id} style={st.fbPostCard}>
                  {/* Post header */}
                  <View style={st.postHeader}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={st.postAvatar} />
                    ) : (
                      <View style={[st.postAvatar, st.avatarFallback]}>
                        <Ionicons name="flag" size={12} color={FB_BLUE} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={st.postAuthor}>{page.name}</Text>
                      <Text style={st.postDate}>{timeAgo(post.createdAt)}</Text>
                    </View>
                    {canManage && (
                      <TouchableOpacity onPress={() => handleRemovePost(post.id)} hitSlop={8}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Post content */}
                  {!!post.content && <Text style={[st.postContent, { paddingHorizontal: 14 }]}>{post.content}</Text>}

                  {/* Post images */}
                  {post.media && post.media.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 2 }}>
                      {post.media.map((item, idx) =>
                        item?.url ? (
                          <Image key={idx} source={{ uri: buildS3Url(item.url) }} style={{ width: screenWidth * 0.85, height: 240, borderRadius: 0 }} resizeMode="cover" />
                        ) : null
                      )}
                    </ScrollView>
                  )}

                  {/* Post stats */}
                  {post.stats && (post.stats.likes || post.stats.comments) ? (
                    <View style={st.postStatsRow}>
                      {(post.stats.likes ?? 0) > 0 && (
                        <Text style={st.postStatText}>👍 {post.stats.likes}</Text>
                      )}
                      {(post.stats.comments ?? 0) > 0 && (
                        <Text style={[st.postStatText, { marginLeft: "auto" }]}>{post.stats.comments} bình luận</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Members tab ── */}
        {activeSection === "members" && (
          <View style={st.tabContent}>
            <View style={st.card}>
              <View style={st.cardHeaderRow}>
                <Text style={st.cardTitle}>Danh sách thành viên</Text>
                {(isAdmin || isOwner) && (
                  <TouchableOpacity
                    onPress={() => { setMemberQuery(""); setSelectedUsers([]); setShowAddMember(true); }}
                    hitSlop={8}
                  >
                    <Ionicons name="person-add" size={22} color={FB_BLUE} />
                  </TouchableOpacity>
                )}
              </View>

              {members.length === 0 ? (
                <View style={st.emptyBlock}>
                  <Ionicons name="people-outline" size={40} color={colors.border} />
                  <Text style={st.emptyText}>Chưa có thành viên nào</Text>
                </View>
              ) : (
                members.map(m => (
                  <View key={m.id ?? m.user?.id} style={st.memberRow}>
                    {m.user?.avatarUrl ? (
                      <Image source={{ uri: buildS3Url(m.user.avatarUrl) }} style={st.memberAvatar} />
                    ) : (
                      <View style={[st.memberAvatar, st.avatarFallback]}>
                        <Ionicons name="person" size={16} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={st.memberName}>{m.user?.name || m.user?.username || "Người dùng"}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <View style={[
                          st.roleBadge,
                          (m.role as string) === "OWNER" && { backgroundColor: "#EDE9FE" },
                          m.role === "ADMIN" && { backgroundColor: FB_BLUE + "20" },
                          m.role === "MODERATOR" && { backgroundColor: "#DBEAFE" },
                        ]}>
                          <Text style={[
                            st.roleBadgeText,
                            (m.role as string) === "OWNER" && { color: "#7C3AED" },
                            m.role === "ADMIN" && { color: FB_BLUE },
                            m.role === "MODERATOR" && { color: "#1E40AF" },
                          ]}>
                            {(m.role as string) === "OWNER" ? "Chủ sở hữu" : m.role === "ADMIN" ? "Admin" : m.role === "MODERATOR" ? "Moderator" : "Thành viên"}
                          </Text>
                        </View>
                        {m.user?.id === numericUserId && (
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>· Bạn</Text>
                        )}
                      </View>
                    </View>
                    {isOwner && (m.role as string) !== "OWNER" && m.user?.id !== numericUserId && (
                      memberActionLoading === m.user?.id ? (
                        <ActivityIndicator size="small" color={colors.textMuted} />
                      ) : (
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          {m.role === "ADMIN" ? (
                            <TouchableOpacity
                              onPress={() => handleDemoteToMember(m.user?.id ?? 0, m.user?.name || m.user?.username || "thành viên")}
                              hitSlop={8}
                              style={st.memberActionBtn}
                            >
                              <Ionicons name="arrow-down-circle-outline" size={22} color="#F59E0B" />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={() => handlePromoteToAdmin(m.user?.id ?? 0, m.user?.name || m.user?.username || "thành viên")}
                              hitSlop={8}
                              style={st.memberActionBtn}
                            >
                              <Ionicons name="shield-outline" size={22} color={FB_BLUE} />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => handleRemoveMember(m.user?.id ?? 0, m.user?.name || m.user?.username || "thành viên")}
                            hitSlop={8}
                            style={st.memberActionBtn}
                          >
                            <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      )
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Report page modal ── */}
      <ReportModal
        visible={showReportModal}
        targetType="PAGE"
        targetId={numericPageId}
        targetName={page.name}
        onClose={() => setShowReportModal(false)}
        onSubmitted={(msg) => Alert.alert("Thành công", msg)}
      />

      {/* ── Create post modal ── */}
      <Modal visible={showCreatePost} animationType="slide" transparent onRequestClose={() => setShowCreatePost(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={[st.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "90%" }]}>
              <View style={st.dragBar} />
              <View style={st.sheetHeader}>
                <TouchableOpacity onPress={() => setShowCreatePost(false)} hitSlop={12}>
                  <Text style={st.sheetCancel}>Hủy</Text>
                </TouchableOpacity>
                <Text style={st.sheetTitle}>Tạo bài viết</Text>
                <TouchableOpacity onPress={handleCreatePost} disabled={creatingPost} hitSlop={12}>
                  <Text style={[st.sheetSave, creatingPost && { color: colors.textMuted }]}>
                    {creatingPost ? "Đang đăng..." : "Đăng"}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
                {/* Author row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: 38, height: 38, borderRadius: 19 }} />
                  ) : (
                    <View style={[{ width: 38, height: 38, borderRadius: 19 }, st.avatarFallback]}>
                      <Ionicons name="flag" size={14} color={FB_BLUE} />
                    </View>
                  )}
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{page?.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Đăng lên trang</Text>
                  </View>
                </View>
                <TextInput
                  style={st.postInput}
                  value={postContent}
                  onChangeText={setPostContent}
                  placeholder="Bạn đang nghĩ gì?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
                <TouchableOpacity style={st.imagePickerRow} onPress={pickPostImages}>
                  <Ionicons name="images-outline" size={22} color={FB_BLUE} />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: FB_BLUE }}>Thêm ảnh / video</Text>
                </TouchableOpacity>
                {postImages.map((img, idx) => (
                  <View key={idx} style={{ position: "relative", marginTop: 10 }}>
                    <Image source={{ uri: buildS3Url(img.uri) }} style={{ width: "100%", height: 200, borderRadius: 12 }} />
                    <TouchableOpacity
                      onPress={() => setPostImages(prev => prev.filter((_, i) => i !== idx))}
                      style={st.removeImageBtn}
                    >
                      <Ionicons name="close" size={16} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add member modal ── */}
      <Modal visible={showAddMember} animationType="slide" transparent onRequestClose={() => setShowAddMember(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={[st.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "80%" }]}>
              <View style={st.dragBar} />
              <View style={st.sheetHeader}>
                <TouchableOpacity
                  onPress={() => { setShowAddMember(false); setMemberQuery(""); setSelectedUsers([]); }}
                  hitSlop={12}
                >
                  <Text style={st.sheetCancel}>Hủy</Text>
                </TouchableOpacity>
                <Text style={st.sheetTitle}>Thêm thành viên</Text>
                <TouchableOpacity onPress={handleAddMembers} disabled={selectedUsers.length === 0 || addingMembers} hitSlop={12}>
                  <Text style={[st.sheetSave, selectedUsers.length === 0 && { color: colors.textMuted }]}>
                    {addingMembers ? "Đang thêm..." : `Thêm (${selectedUsers.length})`}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ paddingHorizontal: 20, paddingTop: 12 }} keyboardShouldPersistTaps="handled">
                <View style={st.memberSearchBar}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    style={{ flex: 1, fontSize: 15, color: colors.text, padding: 0, marginLeft: 8 }}
                    value={memberQuery}
                    onChangeText={setMemberQuery}
                    placeholder="Nhập username để tìm kiếm"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>
                {memberSearching && <ActivityIndicator size="small" color={FB_BLUE} style={{ marginTop: 12 }} />}
                {!memberSearching && memberSearchResults.map(u => {
                  const selected = selectedUsers.some(s => s.id === u.id);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[st.userRow, selected && { borderColor: FB_BLUE, backgroundColor: colors.zalo50 }]}
                      onPress={() => setSelectedUsers(prev => selected ? prev.filter(s => s.id !== u.id) : [...prev, u])}
                      activeOpacity={0.7}
                    >
                      <View style={[st.checkbox, selected && { backgroundColor: FB_BLUE, borderColor: FB_BLUE }]}>
                        {selected && <Ionicons name="checkmark" size={13} color={colors.white} />}
                      </View>
                      {u.avatarUrl ? (
                        <Image source={{ uri: buildS3Url(u.avatarUrl) }} style={st.userAvatar} />
                      ) : (
                        <View style={[st.userAvatar, st.avatarFallback]}>
                          <Ionicons name="person" size={16} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={st.memberName}>{u.name || u.fullName}</Text>
                        <Text style={st.memberSub}>@{u.username}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {!memberSearching && memberQuery.length >= 2 && memberSearchResults.length === 0 && (
                  <Text style={{ textAlign: "center", color: colors.textMuted, marginTop: 20 }}>
                    Không tìm thấy người dùng
                  </Text>
                )}
                {selectedUsers.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 8 }}>
                      Đã chọn ({selectedUsers.length})
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {selectedUsers.map(u => (
                        <View key={u.id} style={st.selectedChip}>
                          <Text style={{ fontSize: 13, color: FB_BLUE, fontWeight: "500" }}>{u.username}</Text>
                          <TouchableOpacity onPress={() => setSelectedUsers(prev => prev.filter(s => s.id !== u.id))} hitSlop={8}>
                            <Ionicons name="close-circle" size={17} color={FB_BLUE} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginTop: 16, marginBottom: 8 }}>Vai trò</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {MEMBER_ROLES.map(r => (
                    <TouchableOpacity
                      key={r.value}
                      style={[st.roleChip, newMemberRole === r.value && { backgroundColor: FB_BLUE, borderColor: FB_BLUE }]}
                      onPress={() => setNewMemberRole(r.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.roleChipText, newMemberRole === r.value && { color: colors.white }]}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#F0F2F5", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as any} size={17} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 1 }}>{label}</Text>
        <Text style={{ fontSize: 14, color: colors.text }}>{value}</Text>
      </View>
    </View>
  );
}

function ManageRow({ icon, label, color, onPress, last }: { icon: string; label: string; color: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[
        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color + "15", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: color, fontWeight: "500" }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: FB_BG },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  loadingCover: { width: "100%", height: COVER_HEIGHT, position: "relative" },
  backLinkBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: FB_BLUE },

  // Hero
  heroSection: { position: "relative" },
  cover: { width: "100%", height: COVER_HEIGHT },
  coverGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 80 },
  coverBackBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverEditBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Profile card
  profileCard: {
    backgroundColor: colors.white,
    marginBottom: 8,
    paddingBottom: 4,
  },
  avatarRow: {
    paddingHorizontal: 16,
    marginTop: -44,
    marginBottom: 8,
  },
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: colors.white,
    overflow: "hidden",
    backgroundColor: colors.zalo50,
  },
  avatar: { width: "100%", height: "100%" },
  avatarFallback: { backgroundColor: colors.zalo50, justifyContent: "center", alignItems: "center" },

  nameSection: { paddingHorizontal: 16, paddingBottom: 12 },
  pageName: { fontSize: 22, fontWeight: "800", color: colors.text },
  pageHandle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  categoryChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: colors.zalo50,
    borderRadius: 12,
  },
  categoryText: { fontSize: 12, color: FB_BLUE, fontWeight: "600" },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  metaText: { fontSize: 13, color: colors.textMuted },
  description: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 10 },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statSep: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  outlineBtn: { backgroundColor: "#F0F2F5", borderColor: "#E0E0E0" },
  activePrimaryBtn: { backgroundColor: FB_BLUE, borderColor: FB_BLUE },
  activeGreenBtn: { backgroundColor: colors.success, borderColor: colors.success },
  joinBtn: { backgroundColor: FB_BLUE, borderColor: FB_BLUE },
  pendingBtn: { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: FB_BLUE },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: FB_BLUE, fontWeight: "700" },

  tabContent: { paddingHorizontal: 12, paddingTop: 4 },

  // Cards
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  ownerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ownerAvatar: { width: 42, height: 42, borderRadius: 21 },
  ownerName: { fontSize: 14, fontWeight: "700", color: colors.text },
  ownerSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  requestRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reqAvatar: { width: 42, height: 42, borderRadius: 21 },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberAvatar: { width: 46, height: 46, borderRadius: 23 },
  memberName: { fontSize: 14, fontWeight: "700", color: colors.text },
  memberSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.zalo50,
  },
  roleBadgeText: { fontSize: 11, color: FB_BLUE, fontWeight: "600" },
  memberActionBtn: { padding: 4 },

  emptyBlock: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: colors.textMuted, marginTop: 8, fontSize: 13, textAlign: "center" },

  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  smallBtnText: { fontSize: 13, fontWeight: "600" },
  bulkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bulkBtnText: { fontSize: 13, fontWeight: "600" },

  // Pending post card
  pendingPostCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },

  // Facebook-style post card
  fbPostCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    paddingBottom: 8,
  },
  postAvatar: { width: 38, height: 38, borderRadius: 19 },
  postAuthor: { fontSize: 14, fontWeight: "700", color: colors.text },
  postDate: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 22, paddingBottom: 10 },
  postImagePreview: { width: "100%", height: 180, borderRadius: 10, marginTop: 8 },
  postStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  postStatText: { fontSize: 13, color: colors.textMuted },

  // Create post prompt
  createPostPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  promptAvatar: { width: 38, height: 38, borderRadius: 19 },
  promptInput: {
    flex: 1,
    backgroundColor: FB_BG,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  promptText: { fontSize: 15, color: colors.textMuted },

  // Modals
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  sheetCancel: { fontSize: 15, color: colors.textMuted, fontWeight: "500" },
  sheetSave: { fontSize: 15, fontWeight: "700", color: FB_BLUE },

  postInput: {
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
    lineHeight: 22,
  },
  imagePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: FB_BG,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    padding: 5,
  },

  memberSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FB_BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatar: { width: 42, height: 42, borderRadius: 21 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    backgroundColor: colors.zalo50,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FB_BLUE,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: FB_BLUE,
    backgroundColor: colors.zalo50,
  },
  roleChipText: { fontSize: 13, fontWeight: "500", color: FB_BLUE },
});
