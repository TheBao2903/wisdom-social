import { useCallback, useMemo, useRef, useState } from "react";
import chatService, {
    type Conversation,
    type ConversationMember,
    type MemberRole,
} from "../services/chatService";
import friendService from "../services/friendService";
import type { User } from "../types";

interface CreateGroupPayload {
    name: string;
    imageUrl?: string;
    memberIds: number[];
    inviteeUserIds?: number[];
}

interface UseGroupManagementParams {
    currentUserId: number;
    selectedConversation: Conversation | null;
    selectedConversationId: number | null;
    reloadConversations: () => Promise<void>;
    onSelectConversation: (conversationId: number) => void;
    onClearSelection: () => void;
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
    if (
        error &&
        typeof error === "object" &&
        "response" in (error as Record<string, unknown>)
    ) {
        const response = (
            error as { response?: { data?: { message?: string } } }
        ).response;
        const serverMessage = response?.data?.message;
        if (serverMessage && serverMessage.trim()) {
            return serverMessage;
        }
    }
    return fallback;
}

export function useGroupManagement({
    currentUserId,
    selectedConversation,
    selectedConversationId,
    reloadConversations,
    onSelectConversation,
    onClearSelection,
}: UseGroupManagementParams) {
    const [friends, setFriends] = useState<User[]>([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friendsError, setFriendsError] = useState<string | null>(null);
    const hasLoadedFriendsRef = useRef(false);

    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
    const [isTransferOwnerModalOpen, setIsTransferOwnerModalOpen] =
        useState(false);

    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isAddingMembers, setIsAddingMembers] = useState(false);
    const [isLeavingGroup, setIsLeavingGroup] = useState(false);
    const [isDisbandingGroup, setIsDisbandingGroup] = useState(false);
    const [isUpdatingMessageRestriction, setIsUpdatingMessageRestriction] = useState(false);
    const [isUpdatingJoinApproval, setIsUpdatingJoinApproval] = useState(false);
    const [pendingJoinRequestId, setPendingJoinRequestId] = useState<number | null>(null);
    const [joinApprovalToast, setJoinApprovalToast] = useState<string | null>(null);

    const [pendingKickUserId, setPendingKickUserId] = useState<number | null>(
        null,
    );
    const [pendingRoleUserId, setPendingRoleUserId] = useState<number | null>(
        null,
    );
    const [pendingTransferOwnerUserId, setPendingTransferOwnerUserId] =
        useState<number | null>(null);

    const [isConfirmLeaveModalOpen, setIsConfirmLeaveModalOpen] =
        useState(false);
    const [isConfirmDisbandModalOpen, setIsConfirmDisbandModalOpen] =
        useState(false);
    const [isConfirmKickModalOpen, setIsConfirmKickModalOpen] = useState(false);
    const [kickTargetUserId, setKickTargetUserId] = useState<number | null>(
        null,
    );

    const [actionError, setActionError] = useState<string | null>(null);

    const selectedGroupConversation = useMemo(() => {
        if (!selectedConversation || selectedConversation.type !== "GROUP") {
            return null;
        }
        return selectedConversation;
    }, [selectedConversation]);

    const groupMembers = useMemo(
        () =>
            (selectedGroupConversation?.members ?? []).filter(
                (member) => !member.status || member.status === "ACTIVE",
            ),
        [selectedGroupConversation],
    );

    const currentMemberRole = useMemo<MemberRole | null>(() => {
        const currentMember = groupMembers.find(
            (member) => member.userId === currentUserId,
        );
        return currentMember?.role ?? null;
    }, [currentUserId, groupMembers]);

    const canManageMembers = currentMemberRole !== null;
    const canKickMembers = currentMemberRole === "OWNER" || currentMemberRole === "DEPUTY";
    const canManageSettings = currentMemberRole === "OWNER" || currentMemberRole === "DEPUTY";
    const canUpdateRole = currentMemberRole === "OWNER";
    const canDisbandGroup = currentMemberRole === "OWNER";

    const groupMemberIds = useMemo(
        () => new Set(groupMembers.map((member) => Number(member.userId))),
        [groupMembers],
    );

    const ownerTransferCandidates = useMemo(
        () =>
            groupMembers.filter(
                (member) =>
                    member.userId !== currentUserId &&
                    (!member.status || member.status === "ACTIVE"),
            ),
        [currentUserId, groupMembers],
    );

    const friendsForCreateGroup = useMemo(
        () => friends.filter((friend) => friend.id !== currentUserId),
        [currentUserId, friends],
    );

    const friendsForAddMembers = useMemo(
        () =>
            friends.filter(
                (friend) =>
                    Number(friend.id) !== Number(currentUserId) &&
                    !groupMemberIds.has(Number(friend.id)),
            ),
        [currentUserId, friends, groupMemberIds],
    );

    const loadFriends = useCallback(
        async (forceRefresh: boolean = false) => {
            if (
                !forceRefresh &&
                (friendsLoading || hasLoadedFriendsRef.current)
            ) {
                return;
            }

            if (!currentUserId) {
                return;
            }

            try {
                setFriendsLoading(true);
                setFriendsError(null);

                const friendList =
                    await friendService.getFriends(currentUserId);
                setFriends(Array.isArray(friendList) ? friendList : []);
                hasLoadedFriendsRef.current = true;
            } catch (error) {
                setFriendsError(
                    normalizeErrorMessage(
                        error,
                        "Không thể tải danh sách bạn bè.",
                    ),
                );
            } finally {
                setFriendsLoading(false);
            }
        },
        [currentUserId, friendsLoading],
    );

    const openCreateGroupModal = useCallback(() => {
        setActionError(null);
        setIsCreateGroupModalOpen(true);
        void loadFriends();
    }, [loadFriends]);

    const closeCreateGroupModal = useCallback(() => {
        setIsCreateGroupModalOpen(false);
    }, []);

    const openAddMembersModal = useCallback(() => {
        if (!selectedGroupConversation || !canManageMembers) {
            return;
        }
        setActionError(null);
        setIsAddMembersModalOpen(true);
        void loadFriends();
    }, [canManageMembers, loadFriends, selectedGroupConversation]);

    const closeAddMembersModal = useCallback(() => {
        setIsAddMembersModalOpen(false);
    }, []);

    const closeTransferOwnerModal = useCallback(() => {
        if (isLeavingGroup) return;
        setIsTransferOwnerModalOpen(false);
    }, [isLeavingGroup]);

    const createGroup = useCallback(
        async (payload: CreateGroupPayload) => {
            const memberIds = Array.from(new Set(payload.memberIds));
            const inviteeUserIds = Array.from(new Set(payload.inviteeUserIds ?? []));
            const hasInvitees = inviteeUserIds.length > 0;
            if (hasInvitees && memberIds.length === 0) {
                setActionError("Vui long chon it nhat 1 ban be de tao nhom.");
                return false;
            }
            if ((!hasInvitees && memberIds.length < 2) || (hasInvitees && memberIds.length + inviteeUserIds.length < 2)) {
                setActionError(
                    "Vui lòng chọn ít nhất 2 thành viên để tạo nhóm.",
                );
                return false;
            }

            try {
                setIsCreatingGroup(true);
                setActionError(null);

                const createdConversation = hasInvitees
                    ? await chatService.createGroupConversationWithInvites({
                        name: payload.name.trim() || undefined,
                        imageUrl: payload.imageUrl?.trim() || undefined,
                        memberIds,
                        inviteeUserIds,
                    })
                    : await chatService.createGroupConversation({
                        name: payload.name.trim() || undefined,
                        imageUrl: payload.imageUrl?.trim() || undefined,
                        memberIds,
                    });

                await reloadConversations();
                onSelectConversation(createdConversation.id);
                setIsCreateGroupModalOpen(false);
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(error, "Không thể tạo nhóm."),
                );
                return false;
            } finally {
                setIsCreatingGroup(false);
            }
        },
        [onSelectConversation, reloadConversations],
    );

    const addMembersToGroup = useCallback(
        async (memberIds: number[], inviteeUserIds: number[] = []) => {
            if (!selectedConversationId || !selectedGroupConversation) {
                setActionError("Không tìm thấy cuộc trò chuyện nhóm.");
                return false;
            }

            const validIds = Array.from(
                new Set(
                    memberIds.filter(
                        (memberId) =>
                            Number(memberId) !== Number(currentUserId) &&
                            !groupMemberIds.has(Number(memberId)),
                    ),
                ),
            );
            const validInviteeIds = Array.from(
                new Set(
                    inviteeUserIds.filter(
                        (memberId) =>
                            Number(memberId) !== Number(currentUserId) &&
                            !groupMemberIds.has(Number(memberId)),
                    ),
                ),
            );

            if (validIds.length === 0 && validInviteeIds.length === 0) {
                setActionError("Vui lòng chọn ít nhất 1 thành viên mới.");
                return false;
            }

            try {
                setIsAddingMembers(true);
                setActionError(null);

                if (validInviteeIds.length > 0) {
                    await chatService.addMembersToGroupWithInvites(selectedConversationId, {
                        newMemberIds: validIds,
                        inviteeUserIds: validInviteeIds,
                    });
                } else {
                    await chatService.addMembersToGroup(selectedConversationId, {
                        newMemberIds: validIds,
                    });
                }
                await reloadConversations();
                setIsAddMembersModalOpen(false);
                if (
                    selectedGroupConversation.isJoinApprovalRequired &&
                    currentMemberRole === "MEMBER"
                ) {
                    setJoinApprovalToast(
                        "Đã gửi yêu cầu tham gia đến Quản trị viên để chờ phê duyệt.",
                    );
                }
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(error, "Không thể thêm thành viên."),
                );
                return false;
            } finally {
                setIsAddingMembers(false);
            }
        },
        [
            currentUserId,
            currentMemberRole,
            groupMemberIds,
            reloadConversations,
            selectedConversationId,
            selectedGroupConversation,
        ],
    );

    const updateMemberRole = useCallback(
        async (targetUserId: number, nextRole: MemberRole) => {
            if (!selectedConversationId || !canUpdateRole) {
                return false;
            }

            try {
                setPendingRoleUserId(targetUserId);
                setActionError(null);
                await chatService.updateGroupMemberRole(
                    selectedConversationId,
                    targetUserId,
                    nextRole,
                );
                await reloadConversations();
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(
                        error,
                        "Không thể cập nhật quyền thành viên.",
                    ),
                );
                return false;
            } finally {
                setPendingRoleUserId(null);
            }
        },
        [canUpdateRole, reloadConversations, selectedConversationId],
    );

    const kickMember = useCallback(
        async (targetUserId: number, blockFromGroup: boolean = false) => {
            if (!selectedConversationId || !canKickMembers) {
                return false;
            }

            try {
                setPendingKickUserId(targetUserId);
                setActionError(null);
                await chatService.kickGroupMember(
                    selectedConversationId,
                    targetUserId,
                    blockFromGroup,
                );
                await reloadConversations();
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(error, "Không thể đuổi thành viên."),
                );
                return false;
            } finally {
                setPendingKickUserId(null);
            }
        },
        [canKickMembers, reloadConversations, selectedConversationId],
    );

    const getBlockedMembers = useCallback(async (): Promise<ConversationMember[]> => {
        if (!selectedConversationId || !canManageSettings) return [];
        return chatService.getBlockedGroupMembers(selectedConversationId);
    }, [canManageSettings, selectedConversationId]);

    const blockMember = useCallback(
        async (targetUserId: number) => {
            if (!selectedConversationId || !canManageSettings) return false;
            try {
                setPendingKickUserId(targetUserId);
                setActionError(null);
                await chatService.blockGroupMember(selectedConversationId, targetUserId);
                await reloadConversations();
                return true;
            } catch (error) {
                setActionError(normalizeErrorMessage(error, "Không thể chặn thành viên."));
                return false;
            } finally {
                setPendingKickUserId(null);
            }
        },
        [canManageSettings, reloadConversations, selectedConversationId],
    );

    const unblockMember = useCallback(
        async (targetUserId: number) => {
            if (!selectedConversationId || !canManageSettings) return false;
            try {
                setPendingKickUserId(targetUserId);
                setActionError(null);
                await chatService.unblockGroupMember(selectedConversationId, targetUserId);
                return true;
            } catch (error) {
                setActionError(normalizeErrorMessage(error, "Không thể bỏ chặn thành viên."));
                return false;
            } finally {
                setPendingKickUserId(null);
            }
        },
        [canManageSettings, selectedConversationId],
    );

    const executeLeaveGroup = useCallback(async () => {
        if (!selectedConversationId || !selectedGroupConversation) {
            return false;
        }

        try {
            setIsLeavingGroup(true);
            setActionError(null);

            if (currentMemberRole === "OWNER" && pendingTransferOwnerUserId) {
                await chatService.updateGroupMemberRole(
                    selectedConversationId,
                    pendingTransferOwnerUserId,
                    "OWNER",
                );
            }

            await chatService.leaveGroup(selectedConversationId);
            await reloadConversations();
            
            setIsConfirmLeaveModalOpen(false);
            setPendingTransferOwnerUserId(null);
            onClearSelection();
            return true;
        } catch (error) {
            setActionError(
                normalizeErrorMessage(error, "Không thể rời nhóm."),
            );
            return false;
        } finally {
            setIsLeavingGroup(false);
        }
    }, [
        currentMemberRole,
        onClearSelection,
        pendingTransferOwnerUserId,
        reloadConversations,
        selectedConversationId,
        selectedGroupConversation,
    ]);

    const transferOwnershipAndLeave = useCallback(
        async (newOwnerUserId: number) => {
            if (!selectedConversationId || !selectedGroupConversation) {
                return false;
            }

            if (currentMemberRole !== "OWNER") {
                setIsConfirmLeaveModalOpen(true);
                return false;
            }

            if (
                !ownerTransferCandidates.some(
                    (candidate) =>
                        Number(candidate.userId) === Number(newOwnerUserId),
                )
            ) {
                setActionError("Vui lòng chọn trưởng nhóm mới hợp lệ.");
                return false;
            }

            setPendingTransferOwnerUserId(newOwnerUserId);
            setIsTransferOwnerModalOpen(false);
            setIsConfirmLeaveModalOpen(true);
            return true;
        },
        [
            currentMemberRole,
            ownerTransferCandidates,
            selectedConversationId,
            selectedGroupConversation,
        ],
    );

    const leaveGroup = useCallback(async () => {
        if (!selectedConversationId || !selectedGroupConversation) {
            return false;
        }

        const shouldTransferOwnerFirst =
            currentMemberRole === "OWNER" && ownerTransferCandidates.length > 0;

        if (shouldTransferOwnerFirst) {
            setActionError(null);
            setIsTransferOwnerModalOpen(true);
        } else {
            setIsConfirmLeaveModalOpen(true);
        }
        
        return true;
    }, [
        currentMemberRole,
        ownerTransferCandidates.length,
        selectedConversationId,
        selectedGroupConversation,
    ]);

    const disbandGroup = useCallback(async () => {
        if (!selectedConversationId || !canDisbandGroup) {
            return false;
        }

        try {
            setIsDisbandingGroup(true);
            setActionError(null);
            await chatService.disbandGroup(selectedConversationId);
            await reloadConversations();
            onClearSelection();
            return true;
        } catch (error) {
            setActionError(
                normalizeErrorMessage(error, "Không thể giải tán nhóm."),
            );
            return false;
        } finally {
            setIsDisbandingGroup(false);
        }
    }, [
        canDisbandGroup,
        onClearSelection,
        reloadConversations,
        selectedConversationId,
    ]);

    const updateMessageRestriction = useCallback(
        async (isRestricted: boolean) => {
            if (!selectedConversationId || !canManageSettings) {
                return false;
            }

            try {
                setIsUpdatingMessageRestriction(true);
                setActionError(null);
                await chatService.updateMessageRestriction(
                    selectedConversationId,
                    isRestricted,
                );
                await reloadConversations();
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(error, "Không thể cập nhật cài đặt."),
                );
                return false;
            } finally {
                setIsUpdatingMessageRestriction(false);
            }
        },
        [canManageSettings, reloadConversations, selectedConversationId],
    );

    const updateJoinApproval = useCallback(
        async (isRequired: boolean) => {
            if (!selectedConversationId || !canManageSettings) {
                return false;
            }

            try {
                setIsUpdatingJoinApproval(true);
                setActionError(null);
                await chatService.updateJoinApprovalRequired(
                    selectedConversationId,
                    isRequired,
                );
                await reloadConversations();
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(error, "Không thể cập nhật cài đặt."),
                );
                return false;
            } finally {
                setIsUpdatingJoinApproval(false);
            }
        },
        [canManageSettings, reloadConversations, selectedConversationId],
    );

    const processJoinRequest = useCallback(
        async (requestId: number, isApproved: boolean) => {
            if (!selectedConversationId || !canManageSettings) {
                return false;
            }

            try {
                setPendingJoinRequestId(requestId);
                setActionError(null);
                await chatService.processJoinRequest(
                    selectedConversationId,
                    requestId,
                    isApproved,
                );
                await reloadConversations();
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(
                        error,
                        "Không thể xử lý yêu cầu tham gia.",
                    ),
                );
                return false;
            } finally {
                setPendingJoinRequestId(null);
            }
        },
        [canManageSettings, reloadConversations, selectedConversationId],
    );

    const clearJoinApprovalToast = useCallback(() => {
        setJoinApprovalToast(null);
    }, []);

    const clearGroupActionError = useCallback(() => {
        setActionError(null);
    }, []);

    const openConfirmKick = useCallback((userId: number) => {
        setKickTargetUserId(userId);
        setIsConfirmKickModalOpen(true);
    }, []);

    const closeConfirmKick = useCallback(() => {
        setKickTargetUserId(null);
        setIsConfirmKickModalOpen(false);
    }, []);

    return {
        selectedGroupConversation,
        groupMembers,
        currentMemberRole,
        canManageMembers,
        canKickMembers,
        canManageSettings,
        canUpdateRole,
        canDisbandGroup,
        groupMemberIds,

        friendsForCreateGroup,
        friendsForAddMembers,
        friendsLoading,
        friendsError,

        isCreateGroupModalOpen,
        isAddMembersModalOpen,
        isTransferOwnerModalOpen,
        isCreatingGroup,
        isAddingMembers,
        isLeavingGroup,
        isDisbandingGroup,
        isUpdatingMessageRestriction,
        isUpdatingJoinApproval,
        pendingKickUserId,
        pendingRoleUserId,
        pendingJoinRequestId,
        pendingTransferOwnerUserId,
        ownerTransferCandidates,

        actionError,
        joinApprovalToast,
        clearGroupActionError,
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
        refreshFriends: loadFriends,

        isConfirmLeaveModalOpen,
        setIsConfirmLeaveModalOpen,
        isConfirmDisbandModalOpen,
        setIsConfirmDisbandModalOpen,
        isConfirmKickModalOpen,
        kickTargetUserId,
        openConfirmKick,
        closeConfirmKick,
    };
}
