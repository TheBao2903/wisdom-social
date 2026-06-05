import {
    Bell,
    MailOpen,
    BellOff,
    Ban,
    Trash2,
    Flag,
    MoreHorizontal,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    CircleUserRound,
    EyeOff,
    FileText,
    Images,
    Link2,
    ListChecks,
    Lock,
    LogOut,
    LucideUserPlus2,
    Pin,
    Plus,
    Search,
    Settings,
    User,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import ChatWindow from "../components/message/ChatWindow";
import ConfirmModal from "../components/message/ConfirmModal";
import ConversationAvatar from "../components/message/ConversationAvatar";
import CreateGroupModal from "../components/message/CreateGroupModal";
import GroupConversationPanel from "../components/message/GroupConversationPanel";
import GroupSettingsModal from "../components/message/GroupSettingsModal";
import InviteLinkModal from "../components/message/InviteLinkModal";
import SelectGroupMembersModal from "../components/message/SelectGroupMembersModal";
import { useGroupManagement } from "../hooks/useGroupManagement";
import { useMessagesController } from "../hooks/useMessagesController";
import { useSidebarLayout } from "../hooks/useSidebarLayout";
import { useAuth } from "../contexts/AuthContext";
import { useFriendDataSafe } from "../contexts/FriendDataContext";
import chatService, {
    type ChatUserSearchResult,
    type ConversationSidebar,
    type ConversationMediaItem,
    type ConversationMediaType,
    type Message,
} from "../services/chatService";
import chatRuntimeStore from "../stores/chatRuntimeStore";
import { buildConversationLastMessagePreview } from "../utils/conversationLastMessagePreview";
import { usePresenceStatus } from "../hooks/usePresenceStatus";

type DetailSectionKey = "chatInfo" | "customize" | "media" | "privacy";
type InfoPanelView = "main" | "polls";

function safeParseMemberIds(content?: string | null): number[] {
    if (!content) return [];

    try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((value) => {
                if (typeof value === "object" && value !== null && "id" in value) {
                    return Number(value.id);
                }
                return Number(value);
            })
            .filter((value) => Number.isFinite(value));
    } catch {
        return [];
    }
}

function isCurrentUserRemovedFromConversation(
    conversation: {
        members?: Array<{ userId: number; status?: string }>;
        lastMessage?: {
            lastMessageType?: string;
            lastMessageContent?: string | null;
            lastSenderId?: number;
        } | null;
    },
    currentUserId: number,
): boolean {
    const currentMember = conversation.members?.find(
        (member) => Number(member.userId) === Number(currentUserId),
    );
    if (
        currentMember?.status === "LEFT" ||
        currentMember?.status === "KICKED" ||
        currentMember?.status === "BLOCKED" ||
        currentMember?.status === "GROUP_DISBANDED"
    ) {
        return true;
    }

    const lastMessage = conversation.lastMessage;
    if (!lastMessage) return false;

    if (lastMessage.lastMessageType === "SYSTEM_DISBAND_GROUP") {
        return true;
    }

    if (
        lastMessage.lastMessageType === "SYSTEM_LEAVE_GROUP" &&
        Number(lastMessage.lastSenderId) === Number(currentUserId)
    ) {
        return true;
    }

    if (
        lastMessage.lastMessageType === "SYSTEM_KICK_MEMBER" ||
        lastMessage.lastMessageType === "SYSTEM_BLOCK_MEMBER"
    ) {
        return safeParseMemberIds(lastMessage.lastMessageContent).some(
            (id) => Number(id) === Number(currentUserId),
        );
    }

    return false;
}

export default function Messages() {
    const INFO_PANEL_WIDTH = 352;
    const { sidebarWidth } = useSidebarLayout();
    const { currentUser } = useAuth();
    const { friends: contextFriends } = useFriendDataSafe();
    const {
        searchQuery,
        setSearchQuery,
        loading,
        error,
        selectedConversationId,
        currentUserId,
        conversations,
        pinnedConversations,
        isPinLimitReached,
        filteredConversations,
        handleSelectConversation,
        clearSelectedConversation,
        handleDeleteConversationForMe,
        pinConversation,
        unpinConversation,
        replacePinnedConversation,
        handleHideConversationForMe,
        getDisplayInfo,
        formatTime,
        clearUnreadCount,
        selectedConversationReadOnlyNotice,
        reload,
    } = useMessagesController();

    const [openMenuConvId, setOpenMenuConvId] = useState<number | null>(null);
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [isInfoPanelRendered, setIsInfoPanelRendered] = useState(false);
    const [infoPanelView, setInfoPanelView] = useState<InfoPanelView>("main");
    const [searchOpenSignal, setSearchOpenSignal] = useState(0);
    const [isGroupSettingsModalOpen, setIsGroupSettingsModalOpen] =
        useState(false);
    const [isInviteLinkModalOpen, setIsInviteLinkModalOpen] = useState(false);
    const groupImageInputRef = useRef<HTMLInputElement>(null);
    const [groupImageUploading, setGroupImageUploading] = useState(false);
    const [groupImageError, setGroupImageError] = useState<string | null>(null);
    const [mediaPanelType, setMediaPanelType] = useState<ConversationMediaType | null>(null);
    const [mediaItems, setMediaItems] = useState<ConversationMediaItem[]>([]);
    const [mediaCursor, setMediaCursor] = useState<string | null>(null);
    const [mediaHasMore, setMediaHasMore] = useState(false);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "IMAGE" | "VIDEO" } | null>(null);
    const [pendingPinConversationId, setPendingPinConversationId] = useState<
        number | null
    >(null);
    const [blockTargetUserId, setBlockTargetUserId] = useState<number | null>(
        null,
    );
    const [transferOwnerTargetUserId, setTransferOwnerTargetUserId] = useState<
        number | null
    >(null);
    const [selectedUnpinConversationId, setSelectedUnpinConversationId] =
        useState<number | null>(null);
    const [isReplacingPin, setIsReplacingPin] = useState(false);
    const [isCreatePollModalOpen, setIsCreatePollModalOpen] = useState(false);
    const [pollTitle, setPollTitle] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [pollCreateSettingsOpen, setPollCreateSettingsOpen] = useState(false);
    const [pollAllowMultipleChoices, setPollAllowMultipleChoices] = useState(true);
    const [pollAllowAddOption, setPollAllowAddOption] = useState(true);
    const [pollPinToTop, setPollPinToTop] = useState(false);
    const [pollHideVoters, setPollHideVoters] = useState(false);
    const [pollExpiresAt, setPollExpiresAt] = useState("");
    const [isCreatingPoll, setIsCreatingPoll] = useState(false);
    const [pollMessages, setPollMessages] = useState<Message[]>([]);
    const [isLoadingPollMessages, setIsLoadingPollMessages] = useState(false);
    const [openPollMessageId, setOpenPollMessageId] = useState<string | null>(null);
    const [openPollModalToken, setOpenPollModalToken] = useState(0);
    const [expandedSections, setExpandedSections] = useState<
        Record<DetailSectionKey, boolean>
    >({
        chatInfo: true,
        customize: true,
        media: true,
        privacy: true,
    });
    const menuRef = useRef<HTMLDivElement>(null);
    const [chatUserSearchResult, setChatUserSearchResult] =
        useState<ChatUserSearchResult | null>(null);
    const [chatUserSearchLoading, setChatUserSearchLoading] = useState(false);
    const [selectedChatUserPreview, setSelectedChatUserPreview] =
        useState<ChatUserSearchResult | null>(null);
    const [selectedChatUserMeta, setSelectedChatUserMeta] =
        useState<ChatUserSearchResult | null>(null);
    const [activeCallConversationId, setActiveCallConversationId] =
        useState<number | null>(null);
    const [previewMessageText, setPreviewMessageText] = useState("");
    const [previewSending, setPreviewSending] = useState(false);

    const selectedConversation =
        conversations.find((conv) => conv.id === selectedConversationId) ||
        (selectedConversationId
            ? chatRuntimeStore.getConversation(selectedConversationId)
            : null) ||
        null;
    const directPartnerIds = useMemo(
        () =>
            filteredConversations
                .filter((conversation) => conversation.type === "DIRECT")
                .map(
                    (conversation) =>
                        Number(
                            conversation.directPartnerId ??
                                conversation.members?.find(
                                    (member) =>
                                        Number(member.userId) !==
                                        Number(currentUserId),
                                )?.userId,
                        ),
                )
                .filter((id): id is number => Number.isFinite(id) && id > 0),
        [currentUserId, filteredConversations],
    );
    const presenceByUserId = usePresenceStatus(directPartnerIds);
    const [forcedStrangerUserIds, setForcedStrangerUserIds] = useState<Set<number>>(
        () => new Set(),
    );
    const friendIdSet = useMemo(
        () =>
            new Set(
                contextFriends
                    .map((friend: any) => Number(friend.id))
                    .filter((id) => Number.isFinite(id)),
            ),
        [contextFriends],
    );
    useEffect(() => {
        const handleBlockStatusChanged = (event: Event) => {
            const detail = (event as CustomEvent<{
                blockerId?: number | null;
                blockedId?: number | null;
            }>).detail;
            const blockerId = Number(detail?.blockerId);
            const blockedId = Number(detail?.blockedId);
            const myId = Number(currentUserId);
            if (!Number.isFinite(myId)) return;

            const otherId =
                blockerId === myId
                    ? blockedId
                    : blockedId === myId
                      ? blockerId
                      : NaN;
            if (!Number.isFinite(otherId)) return;

            setForcedStrangerUserIds((prev) => {
                if (prev.has(otherId)) return prev;
                const next = new Set(prev);
                next.add(otherId);
                return next;
            });
        };

        window.addEventListener(
            "user-block-status-changed",
            handleBlockStatusChanged,
        );
        return () => {
            window.removeEventListener(
                "user-block-status-changed",
                handleBlockStatusChanged,
            );
        };
    }, [currentUserId]);

    useEffect(() => {
        const handleFriendStatusChanged = (event: Event) => {
            const detail = (event as CustomEvent<{
                event?: string;
                senderId?: number | null;
                receiverId?: number | null;
            }>).detail;
            if (detail?.event !== "friend-accept") return;

            const senderId = Number(detail.senderId);
            const receiverId = Number(detail.receiverId);
            const myId = Number(currentUserId);
            if (!Number.isFinite(myId)) return;

            const otherId =
                senderId === myId
                    ? receiverId
                    : receiverId === myId
                      ? senderId
                      : NaN;
            if (!Number.isFinite(otherId)) return;

            setForcedStrangerUserIds((prev) => {
                if (!prev.has(otherId)) return prev;
                const next = new Set(prev);
                next.delete(otherId);
                return next;
            });
        };

        window.addEventListener(
            "friend-status-changed",
            handleFriendStatusChanged,
        );
        return () => {
            window.removeEventListener(
                "friend-status-changed",
                handleFriendStatusChanged,
            );
        };
    }, [currentUserId]);
    const isGroupConversation = selectedConversation?.type === "GROUP";
    const phoneSearchDigits = useMemo(
        () => searchQuery.replace(/\D/g, ""),
        [searchQuery],
    );
    useEffect(() => {
        if (phoneSearchDigits.length !== 10) {
            setChatUserSearchResult(null);
            setChatUserSearchLoading(false);
            return;
        }

        let cancelled = false;
        setChatUserSearchLoading(true);
        chatService
            .searchChatUserByPhone(phoneSearchDigits)
            .then((result) => {
                if (cancelled) return;
                setChatUserSearchResult(result);
            })
            .catch(() => {
                if (!cancelled) setChatUserSearchResult(null);
            })
            .finally(() => {
                if (!cancelled) setChatUserSearchLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [phoneSearchDigits]);

    const handleSelectChatUserSearchResult = useCallback(
        async (result: ChatUserSearchResult) => {
            const existingLocalDirectConversationId =
                result.existingDirectConversationId ??
                conversations.find(
                    (conversation) =>
                        conversation.type === "DIRECT" &&
                        conversation.members?.some(
                            (member) =>
                                Number(member.userId) === Number(result.userId),
                        ),
                )?.id;

            if (existingLocalDirectConversationId) {
                setSelectedChatUserPreview(null);
                setSelectedChatUserMeta(result);
                setSearchQuery("");
                handleSelectConversation(existingLocalDirectConversationId);
                return;
            }
            try {
                const conversation = await chatService.resolveDirectConversation(
                    result.userId,
                );
                chatRuntimeStore.setConversation(conversation.id, conversation);
                setSelectedChatUserPreview(null);
                setSelectedChatUserMeta(result);
                setShowInfoPanel(false);
                setSearchQuery("");
                handleSelectConversation(conversation.id);
                void reload();
            } catch {
                window.alert("Khong the mo cuoc tro chuyen");
            }
        },
        [conversations, handleSelectConversation, reload],
    );

    const handleSendPreviewMessage = useCallback(async () => {
        if (!selectedChatUserPreview || !previewMessageText.trim()) return;
        setPreviewSending(true);
        try {
            const message = await chatService.sendMessage(
                {
                    receiverId: selectedChatUserPreview.userId,
                    content: previewMessageText.trim(),
                    type: "TEXT",
                },
                currentUserId,
            );
            setPreviewMessageText("");
            setSelectedChatUserPreview(null);
            if (message.conversation) {
                chatRuntimeStore.setConversation(message.conversation.id, message.conversation);
            }
            setSearchQuery("");
            handleSelectConversation(message.conversationId);
            void reload();
        } catch {
            window.alert("Khong the gui tin nhan");
        } finally {
            setPreviewSending(false);
        }
    }, [
        currentUserId,
        handleSelectConversation,
        previewMessageText,
        reload,
        selectedChatUserPreview,
    ]);

    const {
        selectedGroupConversation,
        canManageMembers,
        canKickMembers,
        canUpdateRole,
        canManageSettings,
        canDisbandGroup,
        groupMemberIds,
        friendsForCreateGroup,
        friendsForAddMembers,
        friendsLoading,
        friendsError,
        isCreateGroupModalOpen,
        isAddMembersModalOpen,
        isCreatingGroup,
        isAddingMembers,
        isLeavingGroup,
        isDisbandingGroup,
        isUpdatingMessageRestriction,
        isUpdatingJoinApproval,
        isTransferOwnerModalOpen,
        pendingKickUserId,
        pendingRoleUserId,
        pendingJoinRequestId,
        pendingTransferOwnerUserId,
        ownerTransferCandidates,
        actionError,
        joinApprovalToast,
        clearJoinApprovalToast,
        openCreateGroupModal,
        closeCreateGroupModal,
        openAddMembersModal,
        closeAddMembersModal,
        closeTransferOwnerModal,
        createGroup,
        addMembersToGroup,
        updateMemberRole,
        kickMember,
        getBlockedMembers,
        blockMember,
        unblockMember,
        leaveGroup,
        transferOwnershipAndLeave,
        executeLeaveGroup,
        disbandGroup,
        updateMessageRestriction,
        updateJoinApproval,
        processJoinRequest,
        isConfirmLeaveModalOpen,
        setIsConfirmLeaveModalOpen,
        isConfirmDisbandModalOpen,
        setIsConfirmDisbandModalOpen,
        isConfirmKickModalOpen,
        kickTargetUserId,
        openConfirmKick,
        closeConfirmKick,
    } = useGroupManagement({
        currentUserId,
        selectedConversation,
        selectedConversationId,
        reloadConversations: reload,
        onSelectConversation: handleSelectConversation,
        onClearSelection: clearSelectedConversation,
    });

    useEffect(() => {
        if (!joinApprovalToast) return;
        const timer = window.setTimeout(clearJoinApprovalToast, 2600);
        return () => window.clearTimeout(timer);
    }, [clearJoinApprovalToast, joinApprovalToast]);

    const selectedDisplayInfo = selectedConversation
        ? getDisplayInfo(selectedConversation)
        : null;
    const selectedDirectPartnerId = useMemo(() => {
        if (selectedConversation?.type !== "DIRECT") return undefined;

        const candidates = [
            selectedConversation.directPartnerId,
            selectedConversation.members?.find(
                (member) => Number(member.userId) !== Number(currentUserId),
            )?.userId,
            selectedChatUserMeta?.existingDirectConversationId ===
            selectedConversation.id
                ? selectedChatUserMeta.userId
                : undefined,
        ];

        const partnerId = candidates
            .map((value) => Number(value))
            .find(
                (value) =>
                    Number.isFinite(value) &&
                    value > 0 &&
                    value !== Number(currentUserId),
            );

        return partnerId;
    }, [
        currentUserId,
        selectedChatUserMeta?.existingDirectConversationId,
        selectedChatUserMeta?.userId,
        selectedConversation,
    ]);

    const selectedStatus = selectedConversation?.lastMessage?.lastMessageAt
        ? `Hoạt động ${formatTime(selectedConversation.lastMessage.lastMessageAt)} trước`
        : "Đang hoạt động gần đây";
    const pendingPinConversation =
        pendingPinConversationId != null
            ? conversations.find((conv) => conv.id === pendingPinConversationId)
            : null;
    const pendingPinDisplayInfo = pendingPinConversation
        ? getDisplayInfo(pendingPinConversation)
        : null;
    const canCreatePoll =
        Boolean(selectedConversationId) && !selectedConversationReadOnlyNotice;
    const normalizedPollOptions = useMemo(
        () => pollOptions.map((option) => option.trim()).filter(Boolean),
        [pollOptions],
    );
    const duplicatePollOptionIndexes = useMemo(() => {
        const seen = new Set<string>();
        const duplicates = new Set<number>();
        pollOptions.forEach((option, index) => {
            const normalized = option.trim().toLocaleLowerCase("vi-VN");
            if (!normalized) return;
            if (seen.has(normalized)) {
                duplicates.add(index);
                return;
            }
            seen.add(normalized);
        });
        return duplicates;
    }, [pollOptions]);
    const hasDuplicatePollOptions = duplicatePollOptionIndexes.size > 0;
    const canSubmitPoll =
        pollTitle.trim().length > 0 &&
        normalizedPollOptions.length >= 2 &&
        !hasDuplicatePollOptions &&
        !isCreatingPoll;

    const toggleDetailSection = useCallback((key: DetailSectionKey) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const loadPollMessages = useCallback(async () => {
        if (!selectedConversationId || !currentUserId) {
            setPollMessages([]);
            return;
        }

        setIsLoadingPollMessages(true);
        try {
            const response = await chatService.getMessages(
                selectedConversationId,
                currentUserId,
                null,
                100,
            );
            const items = response.data?.data ?? [];
            setPollMessages(items.filter((message) => message.type === "POLL"));
        } catch {
            setPollMessages([]);
        } finally {
            setIsLoadingPollMessages(false);
        }
    }, [currentUserId, selectedConversationId]);

    useEffect(() => {
        if (!showInfoPanel || !selectedConversationId) return;
        void loadPollMessages();
    }, [loadPollMessages, selectedConversationId, showInfoPanel]);

    useEffect(() => {
        setOpenPollMessageId(null);
    }, [selectedConversationId]);

    const resetCreatePollForm = useCallback(() => {
        setPollTitle("");
        setPollOptions(["", ""]);
        setPollCreateSettingsOpen(false);
        setPollAllowMultipleChoices(true);
        setPollAllowAddOption(true);
        setPollPinToTop(false);
        setPollHideVoters(false);
        setPollExpiresAt("");
    }, []);

    const closeCreatePollModal = useCallback(() => {
        if (isCreatingPoll) return;
        setIsCreatePollModalOpen(false);
        resetCreatePollForm();
    }, [isCreatingPoll, resetCreatePollForm]);

    const handlePollOptionChange = useCallback((index: number, value: string) => {
        setPollOptions((previous) =>
            previous.map((option, optionIndex) =>
                optionIndex === index ? value : option,
            ),
        );
    }, []);

    const handleAddPollOption = useCallback(() => {
        setPollOptions((previous) => [...previous, ""]);
    }, []);

    const handleSubmitPoll = useCallback(async () => {
        if (!selectedConversationId || !canSubmitPoll) return;

        setIsCreatingPoll(true);
        try {
            const createdPollMessage = await chatService.createPoll({
                conversationId: selectedConversationId,
                title: pollTitle.trim(),
                options: normalizedPollOptions,
                allowMultipleChoices: pollAllowMultipleChoices,
                allowAddOption: pollAllowAddOption,
                anonymous: pollHideVoters,
                expiresAt: pollExpiresAt
                    ? new Date(pollExpiresAt).toISOString()
                    : null,
            });
            if (pollPinToTop && currentUserId) {
                try {
                    await chatService.pinMessage(createdPollMessage.id, currentUserId);
                } catch {
                    window.alert("Đã tạo bình chọn nhưng không thể ghim lên đầu trò chuyện");
                }
            }
            setIsCreatePollModalOpen(false);
            resetCreatePollForm();
            void loadPollMessages();
        } catch {
            window.alert("Không thể tạo bình chọn");
        } finally {
            setIsCreatingPoll(false);
        }
    }, [
        canSubmitPoll,
        loadPollMessages,
        normalizedPollOptions,
        pollAllowAddOption,
        pollAllowMultipleChoices,
        pollExpiresAt,
        pollHideVoters,
        pollPinToTop,
        pollTitle,
        currentUserId,
        resetCreatePollForm,
        selectedConversationId,
    ]);

    const openPollsView = useCallback(() => {
        setInfoPanelView("polls");
        void loadPollMessages();
    }, [loadPollMessages]);

    const openPollMessageDetail = useCallback((messageId: string) => {
        setOpenPollMessageId(messageId);
        setOpenPollModalToken((token) => token + 1);
    }, []);

    const handleChangeNickname = useCallback(async () => {
        if (!selectedConversationId || !selectedConversation) return;
        if (selectedConversation.type === "GROUP") return;

        const targetMember = (selectedConversation.members ?? []).find(
            (member) => member.userId !== currentUserId,
        );

        if (!targetMember) {
            return;
        }

        const newNickname = window.prompt(
            "Nhập biệt danh mới",
            targetMember.nickname || "",
        );

        if (!newNickname || !newNickname.trim()) {
            return;
        }

        try {
            await chatService.updateConversationMemberNickname({
                conversationId: selectedConversationId,
                targetUserId: targetMember.userId,
                nickname: newNickname.trim(),
            });
        } catch {
            // noop: tên sẽ được đồng bộ lại qua websocket MEMBER_UPDATED
        }
    }, [currentUserId, selectedConversation, selectedConversationId]);

    // Click outside để đóng menu
    void handleChangeNickname;

    useEffect(() => {
        if (!openMenuConvId) return;

        function handleOutside(e: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setOpenMenuConvId(null);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [openMenuConvId]);

    useEffect(() => {
        if (showInfoPanel) {
            setIsInfoPanelRendered(true);
            return;
        }

        const timer = window.setTimeout(() => {
            setIsInfoPanelRendered(false);
        }, 260);

        return () => window.clearTimeout(timer);
    }, [showInfoPanel]);

    useEffect(() => {
        if (!selectedConversationId) {
            setShowInfoPanel(false);
            setInfoPanelView("main");
        }
    }, [selectedConversationId]);

    const closeConfirmTransferOwner = useCallback(() => {
        setTransferOwnerTargetUserId(null);
    }, []);

    const closeGroupDetailSurfaces = useCallback(() => {
        setShowInfoPanel(false);
        setIsGroupSettingsModalOpen(false);
        setIsInviteLinkModalOpen(false);
        closeAddMembersModal();
        closeTransferOwnerModal();
        setIsConfirmLeaveModalOpen(false);
        setIsConfirmDisbandModalOpen(false);
        closeConfirmKick();
        closeConfirmTransferOwner();
    }, [
        closeAddMembersModal,
        closeConfirmKick,
        closeConfirmTransferOwner,
        closeTransferOwnerModal,
        setIsConfirmDisbandModalOpen,
        setIsConfirmLeaveModalOpen,
    ]);

    const handleConversationForbidden = useCallback(() => {
        closeGroupDetailSurfaces();
    }, [closeGroupDetailSurfaces]);

    const handleActiveCallChange = useCallback(
        (conversationId: number, active: boolean) => {
            setActiveCallConversationId((current) => {
                if (active) return conversationId;
                return current === conversationId ? null : current;
            });
        },
        [],
    );

    const getConversationSnapshot = useCallback(
        (conversationId: number) =>
            conversations.find((conv) => conv.id === conversationId) ||
            chatRuntimeStore.getConversation(conversationId) ||
            null,
        [conversations],
    );

    const resolveDirectPartnerId = useCallback(
        (conversation: ConversationSidebar | null) => {
            if (conversation?.type !== "DIRECT") return undefined;

            const partnerId = Number(
                conversation.directPartnerId ??
                    conversation.members?.find(
                        (member) =>
                            Number(member.userId) !== Number(currentUserId),
                    )?.userId,
            );

            return Number.isFinite(partnerId) &&
                partnerId > 0 &&
                partnerId !== Number(currentUserId)
                ? partnerId
                : undefined;
        },
        [currentUserId],
    );

    const renderedChatConversationIds = useMemo(() => {
        const ids: number[] = [];
        if (selectedConversationId) ids.push(selectedConversationId);
        if (
            activeCallConversationId &&
            activeCallConversationId !== selectedConversationId
        ) {
            ids.push(activeCallConversationId);
        }
        return ids;
    }, [activeCallConversationId, selectedConversationId]);

    const closeConfirmBlock = useCallback(() => {
        setBlockTargetUserId(null);
    }, []);

    useEffect(() => {
        if (!selectedConversationReadOnlyNotice) return;
        closeGroupDetailSurfaces();
    }, [closeGroupDetailSurfaces, selectedConversationReadOnlyNotice]);

    const handleDeleteConversation = useCallback(
        (convId: number) => {
            setOpenMenuConvId(null);
            void handleDeleteConversationForMe(convId);
        },
        [handleDeleteConversationForMe],
    );

    const openReplacePinModal = useCallback((conversationId: number) => {
        setPendingPinConversationId(conversationId);
        setSelectedUnpinConversationId(null);
    }, []);

    const closeReplacePinModal = useCallback(() => {
        if (isReplacingPin) return;
        setPendingPinConversationId(null);
        setSelectedUnpinConversationId(null);
    }, [isReplacingPin]);

    const handleToggleConversationPin = useCallback(
        (conversationId: number, isPinnedConversation: boolean) => {
            setOpenMenuConvId(null);

            if (isPinnedConversation) {
                void unpinConversation(conversationId);
                return;
            }

            if (isPinLimitReached) {
                openReplacePinModal(conversationId);
                return;
            }

            void pinConversation(conversationId);
        },
        [
            isPinLimitReached,
            openReplacePinModal,
            pinConversation,
            unpinConversation,
        ],
    );

    const handleConfirmReplacePin = useCallback(async () => {
        if (!pendingPinConversationId || !selectedUnpinConversationId) return;

        setIsReplacingPin(true);
        const success = await replacePinnedConversation(
            selectedUnpinConversationId,
            pendingPinConversationId,
        );
        setIsReplacingPin(false);

        if (success) {
            setPendingPinConversationId(null);
            setSelectedUnpinConversationId(null);
        }
    }, [
        pendingPinConversationId,
        replacePinnedConversation,
        selectedUnpinConversationId,
    ]);

    const handleHideConversation = useCallback(
        (convId: number) => {
            setOpenMenuConvId(null);
            void handleHideConversationForMe(convId);
        },
        [handleHideConversationForMe],
    );

    const handleToggleInfoPanel = useCallback(() => {
        if (!selectedConversationId) {
            return;
        }
        setShowInfoPanel((prev) => !prev);
    }, [selectedConversationId]);

    const handleCloseInfoPanel = useCallback(() => {
        setShowInfoPanel(false);
        setInfoPanelView("main");
    }, []);

    const handleOpenConversationSearch = useCallback(() => {
        if (!selectedConversationId) {
            return;
        }
        setShowInfoPanel(false);
        setInfoPanelView("main");
        setSearchOpenSignal((value) => value + 1);
    }, [selectedConversationId]);

    const handlePickGroupImage = useCallback(() => {
        if (!isGroupConversation || groupImageUploading) return;
        groupImageInputRef.current?.click();
    }, [groupImageUploading, isGroupConversation]);

    const handleGroupImageFileChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !selectedConversationId || !isGroupConversation) return;

            if (!file.type.startsWith("image/")) {
                setGroupImageError("Vui lòng chọn một tệp ảnh.");
                return;
            }

            setGroupImageUploading(true);
            setGroupImageError(null);
            try {
                const { presignedUrl, objectKey } = await chatService.getPresignedUrl(
                    "CONVERSATION",
                    String(selectedConversationId),
                    "IMAGE",
                    file.name,
                    file.type || "image/jpeg",
                );
                await chatService.uploadToS3(presignedUrl, file);
                const updated = await chatService.updateGroupImage(
                    selectedConversationId,
                    objectKey,
                );
                chatRuntimeStore.setConversation(selectedConversationId, updated);
                await reload();
            } catch {
                setGroupImageError("Không thể cập nhật ảnh nhóm. Vui lòng thử lại.");
            } finally {
                setGroupImageUploading(false);
            }
        },
        [isGroupConversation, reload, selectedConversationId],
    );

    const loadConversationMedia = useCallback(
        async (type: ConversationMediaType, cursor: string | null = null) => {
            if (!selectedConversationId || mediaLoading) return;
            setMediaLoading(true);
            try {
                const response = await chatService.getConversationMedia(
                    selectedConversationId,
                    type,
                    cursor,
                    20,
                );
                setMediaItems((prev) =>
                    cursor ? [...prev, ...response.items] : response.items,
                );
                setMediaCursor(response.nextCursor);
                setMediaHasMore(response.hasMore);
            } finally {
                setMediaLoading(false);
            }
        },
        [mediaLoading, selectedConversationId],
    );

    const openMediaPanel = useCallback(
        (type: ConversationMediaType) => {
            setMediaPanelType(type);
            setMediaItems([]);
            setMediaCursor(null);
            setMediaHasMore(false);
            void loadConversationMedia(type, null);
        },
        [loadConversationMedia],
    );

    const menuItemBase =
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-[#363636]";

    const detailSectionButtonClass =
        "flex w-full items-center justify-between rounded-md px-1.5 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800";

    const detailActionButtonClass =
        "flex w-full items-center gap-3 rounded-md px-1.5 py-3 text-left text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800";

    const pollPanelContent = (
        <>
            <div className="flex items-center gap-2 border-b border-gray-200/90 px-4 py-4 dark:border-[#262626]">
                <button
                    type="button"
                    onClick={() => setInfoPanelView("main")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    title="Quay lại"
                >
                    <ChevronLeft size={18} />
                </button>
                <p className="min-w-0 flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Bình chọn
                </p>
                <button
                    type="button"
                    onClick={handleCloseInfoPanel}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    title="Đóng bảng thông tin"
                >
                    <X size={16} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
                {pollMessages.length > 0 ? (
                    <div className="space-y-2">
                        {pollMessages.map((message) => (
                            <button
                                type="button"
                                key={message.id}
                                onClick={() => openPollMessageDetail(message.id)}
                                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50 dark:border-[#303030] dark:bg-[#111111] dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
                            >
                                <div className="flex items-start gap-2">
                                    <ListChecks
                                        size={18}
                                        className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                            {message.poll?.title ||
                                                message.content ||
                                                "Bình chọn"}
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                            {message.poll
                                                ? `${message.poll.options.length} lựa chọn · ${message.poll.totalVoteCount} lượt chọn`
                                                : "Bình chọn trong đoạn chat"}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[360px] flex-col items-center justify-center px-3 text-center">
                        <div className="mb-5 flex h-40 w-44 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-500 dark:border-blue-950 dark:bg-blue-950/20">
                            <ListChecks size={54} />
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {isLoadingPollMessages
                                ? "Đang tải bình chọn..."
                                : "Chưa có bình chọn"}
                        </p>
                    </div>
                )}
            </div>
            <div className="border-t border-gray-200 px-5 py-4 dark:border-[#262626]">
                <button
                    type="button"
                    onClick={() => setIsCreatePollModalOpen(true)}
                    disabled={!canCreatePoll}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                    <ListChecks size={16} />
                    <span>Tạo bình chọn</span>
                </button>
            </div>
        </>
    );

    const mainInfoPanelContent = (
        <>
            <div className="flex items-center justify-between border-b border-gray-200/90 px-5 py-4 dark:border-[#262626]">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Chi tiết đoạn chat
                </p>
                <button
                    type="button"
                    onClick={handleCloseInfoPanel}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    title="Đóng bảng thông tin"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="flex flex-col items-center pb-4 text-center">
                    {selectedConversation && selectedDisplayInfo && (
                        <div className="relative mb-3">
                            <button
                                type="button"
                                onClick={handlePickGroupImage}
                                disabled={!isGroupConversation || groupImageUploading}
                                className={`group relative block rounded-full ${
                                    isGroupConversation
                                        ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-black"
                                        : "cursor-default"
                                }`}
                                title={
                                    isGroupConversation
                                        ? "Cập nhật ảnh nhóm"
                                        : selectedDisplayInfo.name
                                }
                            >
                                <ConversationAvatar
                                    name={selectedDisplayInfo.name}
                                    avatarUrl={selectedDisplayInfo.avatar}
                                    compositeAvatarUrls={
                                        selectedDisplayInfo.hasCompositeAvatar
                                            ? selectedDisplayInfo.compositeAvatars
                                            : undefined
                                    }
                                    fallbackAvatarUrl={
                                        selectedDisplayInfo.fallbackAvatar
                                    }
                                    sizeClassName="h-20 w-20"
                                    ringClassName="ring-1 ring-gray-200 dark:ring-[#242424]"
                                />
                                {isGroupConversation && (
                                    <span className="absolute inset-x-0 bottom-0 rounded-b-full bg-black/55 py-1 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                        {groupImageUploading ? "Đang tải..." : "Đổi ảnh"}
                                    </span>
                                )}
                            </button>
                            {groupImageUploading && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
                                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                </span>
                            )}
                        </div>
                    )}
                    {isGroupConversation && (
                        <input
                            ref={groupImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleGroupImageFileChange}
                        />
                    )}
                    {groupImageError && (
                        <p className="mb-2 text-xs font-medium text-red-500">
                            {groupImageError}
                        </p>
                    )}
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {selectedDisplayInfo?.name || "Không xác định"}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {selectedStatus}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                        <Lock size={12} />
                        Được mã hóa đầu cuối
                    </span>

                    <div className="mt-5 grid w-full grid-cols-3 gap-2">
                        {!isGroupConversation && (
                            <button className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white">
                                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                                    <CircleUserRound size={16} />
                                </span>
                                Trang cá nhân
                            </button>
                        )}
                        <button className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                                <Bell size={16} />
                            </span>
                            Tắt thông báo
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenConversationSearch}
                            className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                                <Search size={16} />
                            </span>
                            Tìm kiếm
                        </button>
                        {isGroupConversation && (
                            <button
                                type="button"
                                onClick={() =>
                                    setIsGroupSettingsModalOpen(true)
                                }
                                className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                                    <Settings size={16} />
                                </span>
                                Quản lý nhóm
                            </button>
                        )}
                    </div>
                </div>

                <div className="h-px bg-gray-300 dark:bg-[#262626]" />

                {selectedGroupConversation && (
                    <>
                        <GroupConversationPanel
                            conversation={selectedGroupConversation}
                            currentUserId={currentUserId}
                            canManageMembers={canManageMembers}
                            canKickMembers={canKickMembers}
                            canUpdateRole={canUpdateRole}
                            pendingJoinRequestId={pendingJoinRequestId}
                            isLeavingGroup={isLeavingGroup}
                            isTransferOwnerModalOpen={isTransferOwnerModalOpen}
                            pendingKickUserId={pendingKickUserId}
                            pendingRoleUserId={pendingRoleUserId}
                            pendingTransferOwnerUserId={
                                pendingTransferOwnerUserId
                            }
                            ownerTransferCandidates={ownerTransferCandidates}
                            actionError={actionError}
                            onOpenAddMembersModal={openAddMembersModal}
                            onLeaveGroup={leaveGroup}
                            onCloseTransferOwnerModal={closeTransferOwnerModal}
                            onTransferOwnershipAndLeave={
                                transferOwnershipAndLeave
                            }
                            onGetBlockedMembers={getBlockedMembers}
                            onOpenConfirmBlock={setBlockTargetUserId}
                            onOpenConfirmTransferOwner={
                                setTransferOwnerTargetUserId
                            }
                            onUnblockMember={unblockMember}
                            onUpdateMemberRole={updateMemberRole}
                            onProcessJoinRequest={processJoinRequest}
                            isConfirmLeaveModalOpen={isConfirmLeaveModalOpen}
                            onSetConfirmLeaveModalOpen={
                                setIsConfirmLeaveModalOpen
                            }
                            isConfirmKickModalOpen={isConfirmKickModalOpen}
                            kickTargetUserId={kickTargetUserId}
                            onOpenConfirmKick={openConfirmKick}
                            onCloseConfirmKick={closeConfirmKick}
                        />
                        <div className="h-px bg-gray-300 dark:bg-[#262626]" />
                    </>
                )}

                <div className="space-y-0">
                    {selectedGroupConversation && (
                        <>
                            <section className="py-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsInviteLinkModalOpen(true)
                                    }
                                    className={detailActionButtonClass}
                                >
                                    <Link2 size={18} />
                                    <span>Link tham gia nhóm</span>
                                </button>
                            </section>
                            <div className="h-px bg-gray-300 dark:bg-[#262626]" />
                        </>
                    )}

                    {isGroupConversation && (
                        <>
                            <div className="h-px bg-gray-300 dark:bg-[#262626]" />

                            <section className="py-2">
                                <button
                                    type="button"
                                    onClick={openPollsView}
                                    className={detailActionButtonClass}
                                >
                                    <ListChecks size={18} />
                                    <span>Bình chọn</span>
                                </button>
                            </section>

                            <div className="h-px bg-gray-300 dark:bg-[#262626]" />
                        </>
                    )}

                    <section className="py-2">
                        <button
                            type="button"
                            onClick={() => toggleDetailSection("media")}
                            className={detailSectionButtonClass}
                        >
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                File phương tiện, File & Link
                            </span>
                            {expandedSections.media ? (
                                <ChevronUp
                                    size={18}
                                    className="text-gray-600 dark:text-gray-300"
                                />
                            ) : (
                                <ChevronDown
                                    size={18}
                                    className="text-gray-600 dark:text-gray-300"
                                />
                            )}
                        </button>
                        {expandedSections.media && (
                            <div className="pb-1">
                                <button
                                    type="button"
                                    onClick={() => openMediaPanel("MEDIA")}
                                    className={detailActionButtonClass}
                                >
                                    <Images size={18} />
                                    <span>File phương tiện</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openMediaPanel("FILE")}
                                    className={detailActionButtonClass}
                                >
                                    <FileText size={18} />
                                    <span>File</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openMediaPanel("LINK")}
                                    className={detailActionButtonClass}
                                >
                                    <Link2 size={18} />
                                    <span>Link</span>
                                </button>
                            </div>
                        )}
                    </section>

                    <div className="h-px bg-gray-400 dark:bg-[#262626]" />

                    <section className="py-2">
                        <button
                            type="button"
                            onClick={() => toggleDetailSection("privacy")}
                            className={detailSectionButtonClass}
                        >
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                Quyền riêng tư và hỗ trợ
                            </span>
                            {expandedSections.privacy ? (
                                <ChevronUp
                                    size={18}
                                    className="text-gray-600 dark:text-gray-300"
                                />
                            ) : (
                                <ChevronDown
                                    size={18}
                                    className="text-gray-600 dark:text-gray-300"
                                />
                            )}
                        </button>
                        {expandedSections.privacy && (
                            <div className="pb-1">
                                <button className={detailActionButtonClass}>
                                    <BellOff size={18} />
                                    <span>Tắt thông báo</span>
                                </button>

                                <button className={detailActionButtonClass}>
                                    <EyeOff size={18} />
                                    <span>Hạn chế</span>
                                </button>
                                <button className={detailActionButtonClass}>
                                    <Ban size={18} />
                                    <span>Chặn</span>
                                </button>
                                <button className="flex w-full items-start justify-between gap-3 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <div className="flex items-start gap-3">
                                        <Flag
                                            size={18}
                                            className="mt-0.5 text-black dark:text-white"
                                        />
                                        <div>
                                            <p className="text-gray-900 dark:text-white">
                                                Báo cáo
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Đóng góp ý kiến và báo cáo cuộc
                                                trò chuyện
                                            </p>
                                        </div>
                                    </div>
                                </button>
                                {isGroupConversation && (
                                    <button
                                        type="button"
                                        onClick={() => void leaveGroup()}
                                        className="flex w-full items-start gap-3 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/10 group"
                                    >
                                        <LogOut
                                            size={18}
                                            className="mt-0.5 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform"
                                        />
                                        <div>
                                            <p className="text-red-600 dark:text-red-400 font-medium">
                                                Rời khỏi nhóm
                                            </p>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
            {selectedGroupConversation && (
                <GroupSettingsModal
                    isOpen={isGroupSettingsModalOpen}
                    onClose={() => setIsGroupSettingsModalOpen(false)}
                    conversation={selectedGroupConversation}
                    canManageSettings={canManageSettings}
                    canDisbandGroup={canDisbandGroup}
                    isDisbandingGroup={isDisbandingGroup}
                    isLeavingGroup={isLeavingGroup}
                    isUpdatingMessageRestriction={isUpdatingMessageRestriction}
                    isUpdatingJoinApproval={isUpdatingJoinApproval}
                    onSetConfirmDisbandModalOpen={setIsConfirmDisbandModalOpen}
                    onUpdateMessageRestriction={updateMessageRestriction}
                    onUpdateJoinApproval={updateJoinApproval}
                />
            )}
            {selectedGroupConversation && (
                <InviteLinkModal
                    key={selectedGroupConversation.id}
                    open={isInviteLinkModalOpen}
                    conversation={selectedGroupConversation}
                    canManageInviteLink={canManageSettings}
                    onClose={() => setIsInviteLinkModalOpen(false)}
                    onChanged={reload}
                />
            )}
            {mediaPanelType && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
                        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                {mediaPanelType === "MEDIA" ? "File phương tiện" : mediaPanelType === "FILE" ? "File" : "Link"}
                            </h3>
                            <button type="button" onClick={() => setMediaPanelType(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {mediaItems.length === 0 && !mediaLoading ? (
                                <p className="py-10 text-center text-sm text-gray-500">Chưa có nội dung</p>
                            ) : mediaPanelType === "MEDIA" ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {mediaItems.map((item) => (
                                        <button key={`${item.messageId}-${item.url}`} type="button" onClick={() => setMediaPreview({ url: item.url, type: item.type === "VIDEO" ? "VIDEO" : "IMAGE" })} className="aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                                            {item.type === "VIDEO" ? (
                                                <video src={item.url} className="h-full w-full object-cover" />
                                            ) : (
                                                <img src={item.url} alt="" className="h-full w-full object-cover" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {mediaItems.map((item) => (
                                        <a key={`${item.messageId}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800">
                                            {mediaPanelType === "LINK" ? <Link2 size={18} /> : <FileText size={18} />}
                                            <span className="min-w-0 flex-1 truncate">{item.fileName || item.content || item.url}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                            {mediaHasMore && (
                                <button type="button" onClick={() => loadConversationMedia(mediaPanelType, mediaCursor)} disabled={mediaLoading} className="mt-4 h-10 w-full rounded-md bg-gray-200 text-sm font-semibold text-gray-800 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100">
                                    {mediaLoading ? "Đang tải..." : "Xem thêm"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {mediaPreview && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/88 px-4 py-6">
                    <button type="button" onClick={() => setMediaPreview(null)} className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20" aria-label="Đóng ảnh">
                        <X size={22} />
                    </button>
                    {mediaPreview.type === "VIDEO" ? (
                        <video src={mediaPreview.url} controls autoPlay className="max-h-full max-w-full rounded-md" />
                    ) : (
                        <img src={mediaPreview.url} alt="Hình ảnh" className="max-h-full max-w-full rounded-md object-contain" />
                    )}
                </div>
            )}
        </>
    );

    const infoPanelContent =
        infoPanelView === "polls" ? pollPanelContent : mainInfoPanelContent;

    return (
        <>
            <div
                className="fixed inset-0 bottom-16 left-0 flex overflow-hidden border-r border-gray-200/80 bg-linear-to-b from-[#f8fafd] to-[#f2f5fa] dark:border-[#262626] dark:from-black dark:to-black md:bottom-0"
                style={{ left: `${sidebarWidth}px` }}
            >
                {/* Left Sidebar - Chat List */}
                <div
                    className={`flex w-full flex-col border-r border-gray-200/80 bg-white/95 backdrop-blur-sm transition-[width] duration-300 ease-out dark:border-[#262626] dark:bg-black ${
                        selectedConversationId
                            ? "md:w-66 lg:w-71"
                            : "md:w-75 lg:w-80"
                    }`}
                >
                    {/* Header */}
                    <div className="border-b border-gray-200/80 p-4 dark:border-[#262626]">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                                    Đoạn chat
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={openCreateGroupModal}
                                title="Tạo nhóm mới"
                                className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#262626] dark:hover:text-white"
                            >
                                <LucideUserPlus2 size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Tìm kiếm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-xl border border-transparent bg-gray-100 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-blue-200 focus:bg-white dark:bg-gray-900 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-900 dark:focus:bg-black"
                            />
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                    aria-label="Xóa tìm kiếm"
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
                        {phoneSearchDigits.length === 10 && chatUserSearchLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-gray-500">Đang tìm người dùng...</p>
                            </div>
                        ) : phoneSearchDigits.length === 10 && chatUserSearchResult ? (
                            <button
                                type="button"
                                onClick={() =>
                                    void handleSelectChatUserSearchResult(
                                        chatUserSearchResult,
                                    )
                                }
                                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                                    selectedChatUserPreview?.userId ===
                                    chatUserSearchResult.userId
                                        ? "border-blue-100 bg-blue-50/90 shadow-sm dark:border-[#262626] dark:bg-gray-900"
                                        : "border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-[#242424] dark:hover:bg-[#131313]"
                                }`}
                            >
                                <ConversationAvatar
                                    name={chatUserSearchResult.name}
                                    avatarUrl={chatUserSearchResult.avatarUrl}
                                    fallbackAvatarUrl={chatUserSearchResult.avatarUrl || ""}
                                    sizeClassName="h-14 w-14"
                                    ringClassName="ring-1 ring-gray-200 dark:ring-[#2a2a2a]"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                        {chatUserSearchResult.name}
                                    </p>
                                    <p className="hidden">
                                        {chatUserSearchResult.friendStatus ===
                                        "FRIEND"
                                            ? "Bạn bè"
                                            : "Người lạ"}
                                        {chatUserSearchResult.mutualGroupsCount >
                                        0
                                            ? ` · Nhóm chung (${chatUserSearchResult.mutualGroupsCount})`
                                            : ""}
                                    </p>
                                </div>
                            </button>
                        ) : phoneSearchDigits.length === 10 && !chatUserSearchLoading ? (
                            <div className="flex items-center justify-center px-4 py-8">
                                <p className="text-center text-sm text-gray-500">
                                    Không tìm thấy người dùng với số này
                                </p>
                            </div>
                        ) : loading ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-gray-500">Đang tải...</p>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center py-8 px-4">
                                <p className="text-gray-500 text-sm text-center">
                                    {error}
                                </p>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-gray-500">
                                    Không có cuộc trò chuyện nào
                                </p>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const displayInfo = getDisplayInfo(conv);
                                const isActive =
                                    selectedConversationId === conv.id;
                                const isMenuOpen = openMenuConvId === conv.id;
                                const isPinnedConversation =
                                    pinnedConversations.some(
                                        (pin) =>
                                            pin.conversationId === conv.id,
                                    );
                                const isRemovedConversation =
                                    isCurrentUserRemovedFromConversation(
                                        conv,
                                        currentUserId,
                                    );
                                const messagePreview =
                                    buildConversationLastMessagePreview({
                                        conversation: conv,
                                        currentUserId,
                                    });
                                const directPartnerId = Number(
                                    conv.type === "DIRECT"
                                        ? conv.directPartnerId ??
                                          conv.members?.find(
                                            (member) =>
                                              Number(member.userId) !==
                                              Number(currentUserId),
                                          )?.userId
                                        : undefined,
                                );
                                const directPartnerMember =
                                    conv.type === "DIRECT"
                                        ? conv.members?.find(
                                            (member) =>
                                              Number(member.userId) ===
                                              Number(directPartnerId),
                                          )
                                        : undefined;
                                const isDirectPartnerUnavailable =
                                    conv.type === "DIRECT" &&
                                    (Boolean(conv.directPartnerLocked) ||
                                        Boolean(
                                            directPartnerMember?.accountLocked,
                                        ) ||
                                        Boolean(conv.directBlockedByMe) ||
                                        Boolean(conv.directBlockedMe));
                                const isDirectPartnerFriend =
                                    conv.type === "DIRECT" &&
                                    Number.isFinite(directPartnerId) &&
                                    friendIdSet.has(Number(directPartnerId)) &&
                                    !forcedStrangerUserIds.has(
                                        Number(directPartnerId),
                                    );
                                const isDirectPartnerOnline = Boolean(
                                    Number.isFinite(directPartnerId) &&
                                        isDirectPartnerFriend &&
                                        !isDirectPartnerUnavailable &&
                                        presenceByUserId[directPartnerId]?.online,
                                );

                                return (
                                    <div
                                        key={conv.id}
                                        className="group/item relative"
                                    >
                                        <div
                                            onClick={() => {
                                                setSelectedChatUserPreview(null);
                                                setSelectedChatUserMeta(null);
                                                setSearchQuery("");
                                                handleSelectConversation(
                                                    conv.id,
                                                );
                                            }}
                                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                                                isActive
                                                    ? "border-blue-100 bg-blue-50/90 shadow-sm dark:border-[#262626] dark:bg-gray-900"
                                                    : "border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-[#242424] dark:hover:bg-[#131313]"
                                            }`}
                                        >
                                            <div className="relative">
                                                <ConversationAvatar
                                                    name={displayInfo.name}
                                                    avatarUrl={
                                                        displayInfo.avatar
                                                    }
                                                    compositeAvatarUrls={
                                                        displayInfo.hasCompositeAvatar
                                                            ? displayInfo.compositeAvatars
                                                            : undefined
                                                    }
                                                    fallbackAvatarUrl={
                                                        displayInfo.fallbackAvatar
                                                    }
                                                    sizeClassName="h-14 w-14"
                                                    ringClassName="ring-1 ring-gray-200 dark:ring-[#2a2a2a]"
                                                />
                                                {isDirectPartnerOnline && (
                                                    <span
                                                        className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-black"
                                                        title="Dang hoat dong"
                                                    />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    {isPinnedConversation && (
                                                        <Pin
                                                            size={13}
                                                            className="shrink-0 fill-red-500 text-red-500"
                                                            aria-label="Đã ghim"
                                                        />
                                                    )}
                                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                        {displayInfo.name}
                                                    </p>
                                                </div>
                                                <p
                                                    className={`${searchQuery.trim() ? "hidden" : "truncate"} text-sm ${
                                                        conv.unreadCount &&
                                                        conv.unreadCount > 0
                                                            ? "font-semibold text-gray-900 dark:text-white"
                                                            : "text-gray-500 dark:text-gray-400"
                                                    }`}
                                                >
                                                    {messagePreview.showSenderPrefix && (
                                                        <>
                                                            <span>
                                                                {
                                                                    messagePreview.senderLabel
                                                                }
                                                            </span>
                                                            {" : "}
                                                        </>
                                                    )}
                                                    {messagePreview.text}
                                                </p>
                                            </div>

                                            <div className={`${searchQuery.trim() ? "hidden" : "flex"} flex-col items-end gap-1.5`}>
                                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                    {conv.lastMessage
                                                        ?.lastMessageAt
                                                        ? formatTime(
                                                              conv.lastMessage
                                                                  .lastMessageAt,
                                                          )
                                                        : ""}
                                                </span>
                                                {(conv.unreadCount ?? 0) >
                                                    0 && (
                                                    <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5">
                                                        <span className="text-xs text-white font-semibold">
                                                            {conv.unreadCount! >
                                                            99
                                                                ? "99+"
                                                                : conv.unreadCount}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Button "..." - hiện khi hover, đặt bên ngoài conversation row */}
                                        <div
                                            ref={isMenuOpen ? menuRef : null}
                                            className="absolute right-3 top-1/2 z-50 -translate-y-1/2"
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuConvId(
                                                        isMenuOpen
                                                            ? null
                                                            : conv.id,
                                                    );
                                                }}
                                                className={`flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm transition-all hover:bg-gray-100 dark:bg-[#262626] dark:text-gray-300 dark:hover:bg-[#363636] ${
                                                    isMenuOpen
                                                        ? "opacity-100"
                                                        : "opacity-0 group-hover/item:opacity-100"
                                                }`}
                                            >
                                                <MoreHorizontal
                                                    size={18}
                                                    className="text-gray-700 dark:text-gray-300"
                                                />
                                            </button>

                                            {/* Context Menu */}
                                            {isMenuOpen && (
                                                <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white py-2 shadow-2xl dark:border-[#363636] dark:bg-[#262626]">
                                                    {/* Mũi tên chỉ lên */}
                                                    <div className="absolute -top-2 right-2 h-4 w-4 rotate-45 border-l border-t border-gray-200 bg-white dark:border-[#363636] dark:bg-[#262626]" />

                                                    {isRemovedConversation ? (
                                                        <button
                                                            onClick={() =>
                                                                handleHideConversation(
                                                                    conv.id,
                                                                )
                                                            }
                                                            className={menuItemBase}
                                                        >
                                                            <Trash2
                                                                size={20}
                                                                className="text-red-500"
                                                            />
                                                            <span className="text-red-500">
                                                                Xóa
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <>
                                                    <button
                                                        onClick={() =>
                                                            handleToggleConversationPin(
                                                                conv.id,
                                                                isPinnedConversation,
                                                            )
                                                        }
                                                        className={menuItemBase}
                                                    >
                                                        <Pin
                                                            size={20}
                                                            className="text-gray-700 dark:text-gray-300"
                                                        />
                                                        <span className="dark:text-white">
                                                            {isPinnedConversation
                                                                ? "Bỏ ghim cuộc trò chuyện"
                                                                : "Ghim cuộc trò chuyện"}
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setOpenMenuConvId(
                                                                null,
                                                            )
                                                        }
                                                        className={menuItemBase}
                                                    >
                                                        <BellOff
                                                            size={20}
                                                            className="text-gray-700 dark:text-gray-300"
                                                        />
                                                        <span className="dark:text-white">
                                                            Tắt thông báo
                                                        </span>
                                                    </button>
                                                    {conv.type === "DIRECT" && (
                                                        <button
                                                            onClick={() =>
                                                                setOpenMenuConvId(
                                                                    null,
                                                                )
                                                            }
                                                            className={
                                                                menuItemBase
                                                            }
                                                        >
                                                            <User
                                                                size={20}
                                                                className="text-gray-700 dark:text-gray-300"
                                                            />
                                                            <span className="dark:text-white">
                                                                Xem trang cá
                                                                nhân
                                                            </span>
                                                        </button>
                                                    )}

                                                    {/* Separator */}
                                                    <div className="my-1 border-t border-gray-200 dark:border-[#363636]" />

                                                    <button
                                                        onClick={() =>
                                                            setOpenMenuConvId(
                                                                null,
                                                            )
                                                        }
                                                        className={menuItemBase}
                                                    >
                                                        <Ban
                                                            size={20}
                                                            className="text-gray-700 dark:text-gray-300"
                                                        />
                                                        <span className="dark:text-white">
                                                            Chặn
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleHideConversation(
                                                                conv.id,
                                                            )
                                                        }
                                                        className={menuItemBase}
                                                    >
                                                        <EyeOff
                                                            size={20}
                                                            className="text-gray-700 dark:text-gray-300"
                                                        />
                                                        <span className="dark:text-white">
                                                            Ẩn đoạn chat
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDeleteConversation(
                                                                conv.id,
                                                            )
                                                        }
                                                        className={menuItemBase}
                                                    >
                                                        <Trash2
                                                            size={20}
                                                            className="text-red-500"
                                                        />
                                                        <span className="text-red-500">
                                                            Xóa đoạn chat
                                                        </span>
                                                    </button>

                                                    {/* Separator */}
                                                    <div className="my-1 border-t border-gray-200 dark:border-[#363636]" />

                                                    <button
                                                        onClick={() =>
                                                            setOpenMenuConvId(
                                                                null,
                                                            )
                                                        }
                                                        className={menuItemBase}
                                                    >
                                                        <Flag
                                                            size={20}
                                                            className="text-gray-700 dark:text-gray-300"
                                                        />
                                                        <span className="dark:text-white">
                                                            Báo cáo
                                                        </span>
                                                    </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Side - Chat Window or Empty State */}
                <div className="hidden min-w-0 flex-1 bg-white dark:bg-black md:flex">
                    {selectedConversationId ? (
                        <div className="relative flex min-w-0 flex-1">
                            <div
                                className={`flex-1 min-w-0 transition-[margin] duration-300 ease-out ${showInfoPanel ? "xl:mr-88" : "xl:mr-0"}`}
                            >
                                {renderedChatConversationIds.map(
                                    (conversationId) => {
                                        const isVisible =
                                            conversationId ===
                                            selectedConversationId;
                                        const conversationForWindow =
                                            isVisible
                                                ? selectedConversation
                                                : getConversationSnapshot(
                                                      conversationId,
                                                  );
                                        const displayInfo = isVisible
                                            ? selectedDisplayInfo
                                            : conversationForWindow
                                              ? getDisplayInfo(
                                                    conversationForWindow,
                                                )
                                              : null;

                                        return (
                                            <div
                                                key={conversationId}
                                                className={
                                                    isVisible
                                                        ? "h-full min-h-0"
                                                        : "hidden"
                                                }
                                            >
                                                <ChatWindow
                                                    conversationId={
                                                        conversationId
                                                    }
                                                    onMarkAsRead={
                                                        clearUnreadCount
                                                    }
                                                    onToggleInfoPanel={
                                                        isVisible
                                                            ? handleToggleInfoPanel
                                                            : undefined
                                                    }
                                                    showInfoPanel={
                                                        isVisible &&
                                                        showInfoPanel
                                                    }
                                                    forcedReadOnlyNotice={
                                                        isVisible
                                                            ? selectedConversationReadOnlyNotice
                                                            : null
                                                    }
                                                    onForbidden={
                                                        handleConversationForbidden
                                                    }
                                                    peerRelationshipInfo={
                                                        isVisible &&
                                                        selectedChatUserMeta &&
                                                        conversationId ===
                                                            (selectedChatUserMeta.existingDirectConversationId ??
                                                                conversationId)
                                                            ? selectedChatUserMeta
                                                            : null
                                                    }
                                                    name={displayInfo?.name}
                                                    avatarUrl={
                                                        displayInfo?.avatar ??
                                                        undefined
                                                    }
                                                    compositeAvatarUrls={
                                                        displayInfo?.hasCompositeAvatar
                                                            ? displayInfo.compositeAvatars
                                                            : undefined
                                                    }
                                                    conversationType={
                                                        conversationForWindow?.type
                                                    }
                                                    conversationMembers={
                                                        conversationForWindow?.members
                                                    }
                                                    directPartnerId={
                                                        isVisible
                                                            ? selectedDirectPartnerId
                                                            : resolveDirectPartnerId(
                                                                  conversationForWindow,
                                                              )
                                                    }
                                                    openPollMessageId={
                                                        isVisible
                                                            ? openPollMessageId
                                                            : null
                                                    }
                                                    openPollModalToken={
                                                        isVisible
                                                            ? openPollModalToken
                                                            : 0
                                                    }
                                                    onPollModalClose={() =>
                                                        setOpenPollMessageId(
                                                            null,
                                                        )
                                                    }
                                                    searchOpenSignal={
                                                        isVisible
                                                            ? searchOpenSignal
                                                            : 0
                                                    }
                                                    onActiveCallChange={
                                                        handleActiveCallChange
                                                    }
                                                />
                                            </div>
                                        );
                                    },
                                )}
                            </div>

                            {isInfoPanelRendered && (
                                <button
                                    type="button"
                                    aria-label="Đóng bảng thông tin"
                                    onClick={handleCloseInfoPanel}
                                    className={`absolute inset-0 z-20 bg-black/20 transition-opacity duration-300 xl:hidden ${showInfoPanel ? "opacity-100" : "pointer-events-none opacity-0"}`}
                                />
                            )}

                            {isInfoPanelRendered && (
                                <aside
                                    className={`absolute inset-y-0 right-0 z-30 hidden shrink-0 overflow-hidden border-l border-gray-200 bg-[#fbfcfe] transition-[transform,opacity] duration-300 ease-out dark:border-[#262626] dark:bg-black xl:flex ${showInfoPanel ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
                                    style={{ width: `${INFO_PANEL_WIDTH}px` }}
                                >
                                    <div className="flex h-full min-h-0 flex-1 flex-col">
                                        {infoPanelContent}
                                    </div>
                                </aside>
                            )}

                            {isInfoPanelRendered && (
                                <aside
                                    className={`absolute inset-y-0 right-0 z-30 flex w-full max-w-88 flex-col overflow-hidden border-l border-gray-200 bg-[#fbfcfe] shadow-2xl transition-[transform,opacity] duration-300 ease-out dark:border-[#262626] dark:bg-black xl:hidden ${showInfoPanel ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
                                >
                                    {infoPanelContent}
                                </aside>
                            )}
                        </div>
                    ) : selectedChatUserPreview ? (
                        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-black">
                            <div className="flex h-23 items-center gap-3 border-b border-gray-200 px-6 dark:border-[#262626]">
                                <ConversationAvatar
                                    name={selectedChatUserPreview.name}
                                    avatarUrl={selectedChatUserPreview.avatarUrl}
                                    fallbackAvatarUrl={selectedChatUserPreview.avatarUrl || ""}
                                    sizeClassName="h-12 w-12"
                                    ringClassName="ring-1 ring-gray-200 dark:ring-[#2a2a2a]"
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                                        {selectedChatUserPreview.name}
                                    </h3>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                            {selectedChatUserPreview.friendStatus ===
                                            "FRIEND"
                                                ? "Bạn bè"
                                                : "Người lạ"}
                                        </span>
                                        {selectedChatUserPreview.mutualGroupsCount >
                                            0 && (
                                            <span>
                                                Nhóm chung (
                                                {
                                                    selectedChatUserPreview.mutualGroupsCount
                                                }
                                                )
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {selectedChatUserPreview.friendStatus !==
                                "FRIEND" && (
                            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#262626] dark:bg-[#080808]">
                                <div className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 dark:bg-black">
                                    <div className="flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                        <LucideUserPlus2 size={18} />
                                        <span>
                                            Gửi yêu cầu kết bạn tới người này
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded bg-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-100"
                                    >
                                        Gửi kết bạn
                                    </button>
                                </div>
                            </div>
                            )}
                            <div className="flex flex-1 items-center justify-center px-6 text-center">
                                <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                    Chưa có cuộc trò chuyện. Tin nhắn đầu tiên sẽ
                                    tạo cuộc hội thoại riêng giữa hai người.
                                </p>
                            </div>
                            <div className="border-t border-gray-200 px-4 py-3 dark:border-[#262626]">
                                <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-900">
                                    <input
                                        value={previewMessageText}
                                        onChange={(event) =>
                                            setPreviewMessageText(
                                                event.target.value,
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" &&
                                                !previewSending
                                            ) {
                                                void handleSendPreviewMessage();
                                            }
                                        }}
                                        disabled={
                                            previewSending ||
                                            selectedChatUserPreview.blocked
                                        }
                                        placeholder={
                                            selectedChatUserPreview.blocked
                                                ? "Không thể nhắn tin với người dùng này"
                                                : "Nhập tin nhắn..."
                                        }
                                        className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-500 dark:text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleSendPreviewMessage()
                                        }
                                        disabled={
                                            previewSending ||
                                            !previewMessageText.trim() ||
                                            selectedChatUserPreview.blocked
                                        }
                                        className="rounded-full p-1.5 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <MailOpen size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-black">
                                    <svg
                                        width="48"
                                        height="48"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        className="dark:stroke-white"
                                    >
                                        <path
                                            d="M12 21L3 13V3h18v10l-9 8z"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                    </svg>
                                </div>
                                <h3 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                                    Tin nhắn của bạn
                                </h3>
                                <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                                    Gửi ảnh và tin nhắn riêng tư cho bạn bè hoặc
                                    nhóm.
                                </p>
                                <button className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                                    Gửi tin nhắn
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {pendingPinConversationId && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6">
                    <div className="w-full max-w-lg overflow-hidden rounded-md border border-gray-200 bg-white shadow-2xl dark:border-[#303030] dark:bg-[#111111]">
                        <div className="border-b border-gray-200 px-5 py-4 dark:border-[#2a2a2a]">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                Ghim hội thoại
                            </h2>
                        </div>

                        <div className="px-5 py-5">
                            <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                                Bạn chỉ được ghim tối đa 4 trò chuyện.
                                <br />
                                Để ghim trò chuyện{" "}
                                <span className="font-semibold">
                                    {pendingPinDisplayInfo?.name ||
                                        "này"}
                                </span>
                                , vui lòng bỏ ghim ít nhất 1 trò chuyện bên
                                dưới.
                            </p>

                            <div className="mt-6 space-y-3">
                                {pinnedConversations.map((pin) => {
                                    const pinnedConversation =
                                        conversations.find(
                                            (conv) =>
                                                conv.id ===
                                                pin.conversationId,
                                        ) ?? pin.conversation;
                                    const pinnedDisplayInfo = pinnedConversation
                                        ? getDisplayInfo(
                                              pinnedConversation as Parameters<
                                                  typeof getDisplayInfo
                                              >[0],
                                          )
                                        : null;
                                    const isSelected =
                                        selectedUnpinConversationId ===
                                        pin.conversationId;

                                    return (
                                        <div
                                            key={pin.conversationId}
                                            className={`flex items-center gap-3 rounded-md border px-1 py-2 transition-colors ${
                                                isSelected
                                                    ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"
                                                    : "border-transparent"
                                            }`}
                                        >
                                            {pinnedDisplayInfo && (
                                                <ConversationAvatar
                                                    name={
                                                        pinnedDisplayInfo.name
                                                    }
                                                    avatarUrl={
                                                        pinnedDisplayInfo.avatar
                                                    }
                                                    compositeAvatarUrls={
                                                        pinnedDisplayInfo.hasCompositeAvatar
                                                            ? pinnedDisplayInfo.compositeAvatars
                                                            : undefined
                                                    }
                                                    fallbackAvatarUrl={
                                                        pinnedDisplayInfo.fallbackAvatar
                                                    }
                                                    sizeClassName="h-11 w-11"
                                                    ringClassName="ring-1 ring-gray-200 dark:ring-[#2a2a2a]"
                                                />
                                            )}
                                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                {pinnedDisplayInfo?.name ||
                                                    `Hội thoại ${pin.conversationId}`}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedUnpinConversationId(
                                                        pin.conversationId,
                                                    )
                                                }
                                                disabled={isReplacingPin}
                                                className={`rounded px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                                                    isSelected
                                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                                        : "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-[#2a2a2a] dark:text-gray-100 dark:hover:bg-[#363636]"
                                                }`}
                                            >
                                                {isSelected
                                                    ? "Đã chọn"
                                                    : "Bỏ ghim"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-[#2a2a2a]">
                            <button
                                type="button"
                                onClick={closeReplacePinModal}
                                disabled={isReplacingPin}
                                className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-300 disabled:opacity-60 dark:bg-[#2a2a2a] dark:text-gray-100 dark:hover:bg-[#363636]"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleConfirmReplacePin()}
                                disabled={
                                    isReplacingPin ||
                                    !selectedUnpinConversationId
                                }
                                className="rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                                {isReplacingPin
                                    ? "Đang ghim..."
                                    : "Ghim hội thoại"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCreatePollModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-4 py-6">
                    <div
                        className={`w-full overflow-hidden rounded-md bg-white shadow-2xl transition-[max-width] dark:bg-[#111111] ${
                            pollCreateSettingsOpen ? "max-w-3xl" : "max-w-lg"
                        }`}
                    >
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-[#2a2a2a]">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                Tạo bình chọn
                            </h2>
                            <button
                                type="button"
                                onClick={closeCreatePollModal}
                                disabled={isCreatingPoll}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                aria-label="Đóng"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div
                            className={`grid gap-6 px-5 py-5 ${
                                pollCreateSettingsOpen
                                    ? "grid-cols-[minmax(0,1fr)_245px]"
                                    : "grid-cols-1"
                            }`}
                        >
                            <div className="space-y-5">
                            <label className="block">
                                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Chủ đề bình chọn
                                </span>
                                <textarea
                                    value={pollTitle}
                                    onChange={(event) =>
                                        setPollTitle(event.target.value.slice(0, 200))
                                    }
                                    placeholder="Đặt câu hỏi bình chọn"
                                    maxLength={200}
                                    className="min-h-28 w-full resize-none rounded border border-blue-500 bg-white px-3 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-500 dark:bg-black dark:text-white"
                                />
                                <p className="mt-1 text-right text-xs text-gray-500">
                                    {pollTitle.length}/200
                                </p>
                            </label>

                            <div>
                                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Các lựa chọn
                                </p>
                                <div className="space-y-2">
                                    {pollOptions.map((option, index) => {
                                        const duplicated =
                                            duplicatePollOptionIndexes.has(index);
                                        return (
                                            <div key={index}>
                                                <input
                                                    value={option}
                                                    onChange={(event) =>
                                                        handlePollOptionChange(
                                                            index,
                                                            event.target.value,
                                                        )
                                                    }
                                                    placeholder={`Lựa chọn ${index + 1}`}
                                                    className={`h-10 w-full rounded-md border bg-white px-3 text-sm text-gray-900 outline-none transition-colors dark:bg-black dark:text-white ${
                                                        duplicated
                                                            ? "border-red-500 focus:border-red-500"
                                                            : "border-gray-300 focus:border-blue-500 dark:border-[#303030]"
                                                    }`}
                                                    aria-invalid={duplicated}
                                                />
                                                {duplicated && (
                                                    <p className="mt-1 text-xs font-medium text-red-500">
                                                        Không được trùng lựa chọn
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddPollOption}
                                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                >
                                    <Plus size={18} />
                                    <span>Thêm lựa chọn</span>
                                </button>
                            </div>
                            </div>

                            {pollCreateSettingsOpen && (
                                <aside className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
                                    <div className="space-y-2">
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            Thời hạn bình chọn
                                        </p>
                                        <input
                                            type="datetime-local"
                                            value={pollExpiresAt}
                                            onChange={(event) =>
                                                setPollExpiresAt(event.target.value)
                                            }
                                            className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500 dark:border-[#303030] dark:bg-black dark:text-gray-100"
                                        />
                                    </div>

                                    <div className="border-t border-gray-200 pt-4 dark:border-[#303030]">
                                        <p className="mb-2 font-semibold text-gray-900 dark:text-white">
                                            Thiết lập nâng cao
                                        </p>
                                        <div className="flex items-center justify-between gap-4 py-1.5">
                                            <span>Ghim lên đầu trò chuyện</span>
                                            <button
                                                type="button"
                                                onClick={() => setPollPinToTop((value) => !value)}
                                                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${pollPinToTop ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
                                                aria-pressed={pollPinToTop}
                                            >
                                                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pollPinToTop ? "translate-x-5" : "translate-x-0"}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 py-1.5">
                                            <span>Chọn nhiều phương án</span>
                                            <button
                                                type="button"
                                                onClick={() => setPollAllowMultipleChoices((value) => !value)}
                                                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${pollAllowMultipleChoices ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
                                                aria-pressed={pollAllowMultipleChoices}
                                            >
                                                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pollAllowMultipleChoices ? "translate-x-5" : "translate-x-0"}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 py-1.5">
                                            <span>Có thể thêm phương án</span>
                                            <button
                                                type="button"
                                                onClick={() => setPollAllowAddOption((value) => !value)}
                                                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${pollAllowAddOption ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
                                                aria-pressed={pollAllowAddOption}
                                            >
                                                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pollAllowAddOption ? "translate-x-5" : "translate-x-0"}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 pt-4 dark:border-[#303030]">
                                        <p className="mb-2 font-semibold text-gray-900 dark:text-white">
                                            Bình chọn ẩn danh
                                        </p>
                                        
                                        <div className="flex items-center justify-between gap-4 py-1.5">
                                            <span>Ẩn người bình chọn</span>
                                            <button
                                                type="button"
                                                onClick={() => setPollHideVoters((value) => !value)}
                                                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${pollHideVoters ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
                                                aria-pressed={pollHideVoters}
                                            >
                                                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pollHideVoters ? "translate-x-5" : "translate-x-0"}`} />
                                            </button>
                                        </div>
                                    </div>
                                </aside>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 dark:border-[#2a2a2a]">
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setPollCreateSettingsOpen((open) => !open)}
                                    disabled={isCreatingPoll}
                                    className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors disabled:opacity-60 ${
                                        pollCreateSettingsOpen
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
                                            : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                                    }`}
                                    title="Cai dat nang cao"
                                >
                                    <Settings size={22} />
                                </button>
                            </div>
                            <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeCreatePollModal}
                                disabled={isCreatingPoll}
                                className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-300 disabled:opacity-60 dark:bg-[#2a2a2a] dark:text-gray-100 dark:hover:bg-[#363636]"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSubmitPoll()}
                                disabled={!canSubmitPoll}
                                className="rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                                {isCreatingPoll ? "Đang tạo..." : "Tạo bình chọn"}
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            )}

            <CreateGroupModal
                open={isCreateGroupModalOpen}
                friends={friendsForCreateGroup}
                loadingFriends={friendsLoading}
                friendsError={friendsError}
                submitting={isCreatingGroup}
                error={actionError}
                currentUserName={
                    currentUser?.fullName ||
                    currentUser?.name ||
                    currentUser?.username
                }
                onClose={closeCreateGroupModal}
                onSubmit={createGroup}
            />

            {joinApprovalToast && (
                <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-700">
                    {joinApprovalToast}
                </div>
            )}

            <SelectGroupMembersModal
                open={isAddMembersModalOpen}
                friends={friendsForAddMembers}
                existingMemberIds={groupMemberIds}
                loadingFriends={friendsLoading}
                friendsError={friendsError}
                submitting={isAddingMembers}
                error={actionError}
                onClose={closeAddMembersModal}
                onSubmit={addMembersToGroup}
            />
            <ConfirmModal
                open={isConfirmLeaveModalOpen}
                title="Rời khỏi nhóm?"
                description={`Bạn có chắc chắn muốn rời khỏi nhóm "${selectedGroupConversation?.name || "này"}"? Hành động này không thể hoàn tác.`}
                confirmLabel="Rời nhóm"
                loading={isLeavingGroup}
                isDanger={true}
                onClose={() => setIsConfirmLeaveModalOpen(false)}
                onConfirm={() => {
                    void executeLeaveGroup().then((success) => {
                        if (success) setIsConfirmLeaveModalOpen(false);
                    });
                }}
            />

            <ConfirmModal
                open={isConfirmDisbandModalOpen}
                title="Giải tán nhóm?"
                description={`Giải tán nhóm "${selectedGroupConversation?.name || "này"}" sẽ kết thúc cuộc trò chuyện cho tất cả thành viên. Mọi tin nhắn sẽ bị xóa đối với mọi người.`}
                confirmLabel="Giải tán"
                loading={isDisbandingGroup}
                isDanger={true}
                onClose={() => setIsConfirmDisbandModalOpen(false)}
                onConfirm={() => {
                    void disbandGroup().then((success) => {
                        if (success) setIsConfirmDisbandModalOpen(false);
                    });
                }}
            />

            <ConfirmModal
                open={isConfirmKickModalOpen}
                title="Đuổi thành viên?"
                description={`Bạn có chắc chắn muốn mời ${
                    kickTargetUserId && selectedGroupConversation?.members
                        ? selectedGroupConversation.members.find(
                              (m) => m.userId === kickTargetUserId,
                          )?.nickname || "thành viên này"
                        : "thành viên"
                } khỏi nhóm?`}
                confirmLabel="Đuổi khỏi nhóm"
                isDanger={true}
                onClose={() => {
                    closeConfirmKick();
                }}
                onConfirm={() => {
                    if (kickTargetUserId) {
                        void kickMember(kickTargetUserId).then((success) => {
                            if (success) {
                                closeConfirmKick();
                            }
                        });
                    }
                }}
            />

            <ConfirmModal
                open={blockTargetUserId != null}
                title="Chặn thành viên?"
                description={`Bạn có chắc chắn muốn chặn ${
                    blockTargetUserId && selectedGroupConversation?.members
                        ? selectedGroupConversation.members.find(
                              (m) => m.userId === blockTargetUserId,
                          )?.nickname || "thành viên này"
                        : "thành viên"
                } khỏi nhóm? Người này sẽ không thể tham gia lại nếu chưa được bỏ chặn.`}
                confirmLabel="Chặn khỏi nhóm"
                isDanger={true}
                onClose={closeConfirmBlock}
                onConfirm={() => {
                    if (blockTargetUserId) {
                        void blockMember(blockTargetUserId).then((success) => {
                            if (success) {
                                closeConfirmBlock();
                            }
                        });
                    }
                }}
            />
            <ConfirmModal
                open={transferOwnerTargetUserId != null}
                title="Chuyển trưởng nhóm?"
                description={`Bạn có chắc chắn muốn chuyển quyền trưởng nhóm cho ${
                    transferOwnerTargetUserId &&
                    selectedGroupConversation?.members
                        ? selectedGroupConversation.members.find(
                              (m) => m.userId === transferOwnerTargetUserId,
                          )?.nickname || "thành viên này"
                        : "thành viên"
                }? Sau khi chuyển, bạn sẽ trở thành thành viên thường.`}
                confirmLabel="Chuyển quyền"
                onClose={closeConfirmTransferOwner}
                onConfirm={() => {
                    if (transferOwnerTargetUserId) {
                        void updateMemberRole(
                            transferOwnerTargetUserId,
                            "OWNER",
                        ).then((success) => {
                            if (success) {
                                closeConfirmTransferOwner();
                            }
                        });
                    }
                }}
            />
        </>
    );
}
