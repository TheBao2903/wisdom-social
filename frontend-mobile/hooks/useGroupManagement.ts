import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import chatService from "@/services/chatService";
import friendService, { type FriendUser } from "@/services/friendService";
import chatRuntimeStore from "@/stores/chatRuntimeStore";
import type { Conversation, ConversationMember, MemberRole } from "@/types/chat";

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
    onSelectConversation?: (conversationId: number) => void;
    onClearSelection?: () => void;
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
    const [friends, setFriends] = useState<FriendUser[]>([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friendsError, setFriendsError] = useState<string | null>(null);
    const hasLoadedFriendsRef = useRef(false);
    const friendsLoadingRef = useRef(false);

    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
    const [isTransferOwnerModalOpen, setIsTransferOwnerModalOpen] =
        useState(false);

    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isAddingMembers, setIsAddingMembers] = useState(false);
    const [isLeavingGroup, setIsLeavingGroup] = useState(false);
    const [isDisbandingGroup, setIsDisbandingGroup] = useState(false);
    const [isUpdatingMessageRestriction, setIsUpdatingMessageRestriction] =
        useState(false);
    const [isUpdatingJoinApproval, setIsUpdatingJoinApproval] =
        useState(false);
    const [pendingJoinRequestId, setPendingJoinRequestId] = useState<
        number | null
    >(null);

    const [pendingKickUserId, setPendingKickUserId] = useState<number | null>(
        null,
    );
    const [pendingRoleUserId, setPendingRoleUserId] = useState<number | null>(
        null,
    );
    const [pendingTransferOwnerUserId, setPendingTransferOwnerUserId] =
        useState<number | null>(null);

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
            (member) => Number(member.userId) === Number(currentUserId),
        );

        return currentMember?.role ?? null;
    }, [currentUserId, groupMembers]);

    const canManageMembers = currentMemberRole !== null;
    const canAddMembers = groupMembers.some(
        (member) => Number(member.userId) === Number(currentUserId),
    );
    const canUpdateRole = currentMemberRole === "OWNER";
    const canManageSettings =
        currentMemberRole === "OWNER" || currentMemberRole === "DEPUTY";
    const canDisbandGroup = currentMemberRole === "OWNER";

    const groupMemberIds = useMemo(
        () => new Set(groupMembers.map((member) => Number(member.userId))),
        [groupMembers],
    );

    const ownerTransferCandidates = useMemo(
        () =>
            groupMembers.filter(
                (member) =>
                    Number(member.userId) !== Number(currentUserId) &&
                    (!member.status || member.status === "ACTIVE"),
            ),
        [currentUserId, groupMembers],
    );

    const availableFriends = useMemo(
        () =>
            friends.filter(
                (friend) => Number(friend.id) !== Number(currentUserId),
            ),
        [currentUserId, friends],
    );

    const loadFriends = useCallback(
        async (forceRefresh = false) => {
            // Dùng ref thay vì state để tránh stale closure trong dependency array
            if (
                !forceRefresh &&
                (friendsLoadingRef.current || hasLoadedFriendsRef.current)
            ) {
                return;
            }

            if (!currentUserId) {
                return;
            }

            try {
                friendsLoadingRef.current = true;
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
                friendsLoadingRef.current = false;
                setFriendsLoading(false);
            }
        },
        [currentUserId], // Bỏ friendsLoading khỏi deps – dùng ref để guard thay thế
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
        if (!selectedGroupConversation || !canAddMembers) return;

        setActionError(null);
        setIsAddMembersModalOpen(true);
        void loadFriends();
    }, [canAddMembers, loadFriends, selectedGroupConversation]);

    const closeAddMembersModal = useCallback(() => {
        setIsAddMembersModalOpen(false);
    }, []);

    const closeTransferOwnerModal = useCallback(() => {
        if (isLeavingGroup) return;
        setIsTransferOwnerModalOpen(false);
    }, [isLeavingGroup]);

    const reloadSelectedGroupConversation = useCallback(async (
        memberSnapshotVersion?: number,
    ) => {
        if (!selectedConversationId || !currentUserId) {
            await reloadConversations();
            return;
        }

        const response = await chatService.getConversation(
            selectedConversationId,
            currentUserId,
        );

        if (response.success && response.data) {
            chatRuntimeStore.setConversation(
                selectedConversationId,
                response.data,
                { memberSnapshotVersion },
            );
        }

        await reloadConversations();
    }, [currentUserId, reloadConversations, selectedConversationId]);

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

                chatRuntimeStore.setConversation(
                    createdConversation.id,
                    createdConversation,
                );
                await reloadConversations();
                onSelectConversation?.(createdConversation.id);
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
                const memberSnapshotVersion =
                    chatRuntimeStore.markMembersChanging(
                        selectedConversationId,
                    );

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
                chatRuntimeStore.removePendingRequests(selectedConversationId, {
                    userIds: [...validIds, ...validInviteeIds],
                });
                await reloadSelectedGroupConversation(memberSnapshotVersion);
                setIsAddMembersModalOpen(false);
                if (
                    selectedGroupConversation.isJoinApprovalRequired &&
                    currentMemberRole === "MEMBER"
                ) {
                    Alert.alert(
                        "Đã gửi yêu cầu",
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
            reloadSelectedGroupConversation,
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
                const memberSnapshotVersion =
                    chatRuntimeStore.markMembersChanging(
                        selectedConversationId,
                    );

                await chatService.updateGroupMemberRole(
                    selectedConversationId,
                    targetUserId,
                    nextRole,
                );
                await reloadSelectedGroupConversation(memberSnapshotVersion);
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
        [canUpdateRole, reloadSelectedGroupConversation, selectedConversationId],
    );

    const kickMember = useCallback(
        async (targetUserId: number, blockFromGroup = false) => {
            if (!selectedConversationId || !canManageMembers) {
                return false;
            }

            try {
                setPendingKickUserId(targetUserId);
                setActionError(null);
                const memberSnapshotVersion =
                    chatRuntimeStore.markMembersChanging(
                        selectedConversationId,
                    );

                await chatService.kickGroupMember(
                    selectedConversationId,
                    targetUserId,
                    blockFromGroup,
                );
                chatRuntimeStore.removePendingRequests(selectedConversationId, {
                    userIds: [targetUserId],
                });
                await reloadSelectedGroupConversation(memberSnapshotVersion);
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
        [canManageMembers, reloadSelectedGroupConversation, selectedConversationId],
    );

    const leaveGroupDirectly = useCallback(async () => {
        if (!selectedConversationId || !selectedGroupConversation) {
            return false;
        }

        try {
            setIsLeavingGroup(true);
            setActionError(null);

            await chatService.leaveGroup(selectedConversationId);
            await reloadConversations();
            onClearSelection?.();
            return true;
        } catch (error) {
            setActionError(normalizeErrorMessage(error, "Không thể rời nhóm."));
            return false;
        } finally {
            setIsLeavingGroup(false);
        }
    }, [
        onClearSelection,
        reloadConversations,
        selectedConversationId,
        selectedGroupConversation,
    ]);

    const leaveGroup = useCallback(async () => {
        if (!selectedConversationId || !selectedGroupConversation) {
            return false;
        }

        const shouldTransferOwnerFirst =
            currentMemberRole === "OWNER" && ownerTransferCandidates.length > 0;

        if (shouldTransferOwnerFirst) {
            setActionError(null);
            setIsTransferOwnerModalOpen(true);
            return false;
        }

        return leaveGroupDirectly();
    }, [
        currentMemberRole,
        leaveGroupDirectly,
        ownerTransferCandidates.length,
        selectedConversationId,
        selectedGroupConversation,
    ]);

    const transferOwnershipAndLeave = useCallback(
        async (newOwnerUserId: number) => {
            if (!selectedConversationId || !selectedGroupConversation) {
                return false;
            }

            if (currentMemberRole !== "OWNER") {
                return leaveGroupDirectly();
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

            try {
                setIsLeavingGroup(true);
                setPendingTransferOwnerUserId(newOwnerUserId);
                setActionError(null);

                await chatService.updateGroupMemberRole(
                    selectedConversationId,
                    newOwnerUserId,
                    "OWNER",
                );
                await chatService.leaveGroup(selectedConversationId);

                await reloadConversations();
                setIsTransferOwnerModalOpen(false);
                onClearSelection?.();
                return true;
            } catch (error) {
                setActionError(
                    normalizeErrorMessage(
                        error,
                        "Không thể chuyển trưởng nhóm và rời nhóm.",
                    ),
                );
                return false;
            } finally {
                setIsLeavingGroup(false);
                setPendingTransferOwnerUserId(null);
            }
        },
        [
            currentMemberRole,
            leaveGroupDirectly,
            onClearSelection,
            ownerTransferCandidates,
            reloadConversations,
            selectedConversationId,
            selectedGroupConversation,
        ],
    );

    const disbandGroup = useCallback(async () => {
        if (!selectedConversationId || !canDisbandGroup) {
            return false;
        }

        try {
            setIsDisbandingGroup(true);
            setActionError(null);

            await chatService.disbandGroup(selectedConversationId);
            await reloadConversations();
            onClearSelection?.();
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
                await reloadSelectedGroupConversation();
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
        [canManageSettings, reloadSelectedGroupConversation, selectedConversationId],
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
                await reloadSelectedGroupConversation();
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
        [canManageSettings, reloadSelectedGroupConversation, selectedConversationId],
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
                const memberSnapshotVersion = chatRuntimeStore.markMembersChanging(selectedConversationId);
                await chatService.blockGroupMember(selectedConversationId, targetUserId);
                await reloadSelectedGroupConversation(memberSnapshotVersion);
                return true;
            } catch (error) {
                setActionError(normalizeErrorMessage(error, "Không thể chặn thành viên."));
                return false;
            } finally {
                setPendingKickUserId(null);
            }
        },
        [canManageSettings, reloadSelectedGroupConversation, selectedConversationId],
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

    const getPendingJoinRequestCount = useCallback(async () => {
        if (!selectedConversationId || !canManageSettings) {
            return 0;
        }

        try {
            const requests =
                await chatService.getPendingJoinRequests(selectedConversationId);
            return requests.length;
        } catch {
            return selectedGroupConversation?.pendingRequests?.length ?? 0;
        }
    }, [
        canManageSettings,
        selectedConversationId,
        selectedGroupConversation?.pendingRequests,
    ]);

    const processJoinRequest = useCallback(
        async (requestId: number, isApproved: boolean) => {
            if (!selectedConversationId || !canManageSettings) {
                return false;
            }

            try {
                setPendingJoinRequestId(requestId);
                setActionError(null);
                const memberSnapshotVersion =
                    chatRuntimeStore.markMembersChanging(
                        selectedConversationId,
                    );
                await chatService.processJoinRequest(
                    selectedConversationId,
                    requestId,
                    isApproved,
                );
                chatRuntimeStore.removePendingRequests(selectedConversationId, {
                    requestIds: [requestId],
                });
                await reloadSelectedGroupConversation(memberSnapshotVersion);
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
        [canManageSettings, reloadSelectedGroupConversation, selectedConversationId],
    );

    const clearGroupActionError = useCallback(() => {
        setActionError(null);
    }, []);

    return {
        selectedGroupConversation,
        groupMembers,
        currentMemberRole,
        canManageMembers,
        canAddMembers,
        canUpdateRole,
        canManageSettings,
        canDisbandGroup,
        groupMemberIds,

        availableFriends,
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
        clearGroupActionError,

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
        disbandGroup,
        updateMessageRestriction,
        updateJoinApproval,
        getPendingJoinRequestCount,
        processJoinRequest,
        refreshFriends: loadFriends,
    };
}
