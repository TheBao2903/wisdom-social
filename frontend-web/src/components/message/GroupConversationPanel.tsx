import { useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowLeft,
    ChevronDown,
    Clock,
    Crown,
    MoreHorizontal,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import type {
    Conversation,
    ConversationMember,
    JoinRequest,
    MemberRole,
} from "../../services/chatService";
import { DEFAULT_AVATAR_URL } from "../../constants/ui";
import { buildS3Url } from "../../utils/s3";
import {
    LOCKED_ACCOUNT_AVATAR_URL,
    LOCKED_ACCOUNT_NAME,
} from "../../utils/lockedAccount";
import TransferOwnershipModal from "./TransferOwnershipModal";

interface GroupConversationPanelProps {
    conversation: Conversation;
    currentUserId: number;
    canManageMembers: boolean;
    canKickMembers: boolean;
    canUpdateRole: boolean;
    isLeavingGroup: boolean;
    isTransferOwnerModalOpen: boolean;
    pendingKickUserId: number | null;
    pendingRoleUserId: number | null;
    pendingJoinRequestId: number | null;
    pendingTransferOwnerUserId: number | null;
    ownerTransferCandidates: ConversationMember[];
    actionError: string | null;
    isConfirmLeaveModalOpen: boolean;
    onSetConfirmLeaveModalOpen: (open: boolean) => void;
    isConfirmKickModalOpen: boolean;
    kickTargetUserId: number | null;
    onOpenConfirmKick: (userId: number) => void;
    onCloseConfirmKick: () => void;
    onOpenAddMembersModal: () => void;
    onLeaveGroup: () => Promise<boolean>;
    onCloseTransferOwnerModal: () => void;
    onTransferOwnershipAndLeave: (newOwnerUserId: number) => Promise<boolean>;
    onGetBlockedMembers: () => Promise<ConversationMember[]>;
    onOpenConfirmBlock: (userId: number) => void;
    onOpenConfirmTransferOwner: (userId: number) => void;
    onUnblockMember: (targetUserId: number) => Promise<boolean>;
    onUpdateMemberRole: (
        targetUserId: number,
        nextRole: MemberRole,
    ) => Promise<boolean>;
    onProcessJoinRequest: (
        requestId: number,
        isApproved: boolean,
    ) => Promise<boolean>;
}

void ({} as Pick<
    GroupConversationPanelProps,
    | "canKickMembers"
    | "canUpdateRole"
    | "pendingKickUserId"
    | "pendingRoleUserId"
    | "isConfirmLeaveModalOpen"
    | "onSetConfirmLeaveModalOpen"
    | "isConfirmKickModalOpen"
    | "kickTargetUserId"
    | "onOpenConfirmKick"
    | "onCloseConfirmKick"
>);

function sortMembers(members: ConversationMember[]): ConversationMember[] {
    const roleOrder: Record<MemberRole, number> = {
        OWNER: 0,
        DEPUTY: 1,
        MEMBER: 2,
    };

    return [...members].sort((a, b) => {
        const firstRole = a.role ?? "MEMBER";
        const secondRole = b.role ?? "MEMBER";

        if (roleOrder[firstRole] !== roleOrder[secondRole]) {
            return roleOrder[firstRole] - roleOrder[secondRole];
        }

        return (a.nickname || "").localeCompare(b.nickname || "");
    });
}

function formatRelativeTime(value?: string): string {
    if (!value) return "";
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "";

    const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (diffSeconds < 60) return "Vừa xong";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
}

export default function GroupConversationPanel({
    conversation,
    currentUserId,
    canManageMembers,
    canKickMembers,
    isLeavingGroup,
    isTransferOwnerModalOpen,
    pendingJoinRequestId,
    pendingTransferOwnerUserId,
    ownerTransferCandidates,
    actionError,
    onOpenAddMembersModal,
    onOpenConfirmKick,
    onLeaveGroup,
    onCloseTransferOwnerModal,
    onTransferOwnershipAndLeave,
    onGetBlockedMembers,
    onOpenConfirmBlock,
    onOpenConfirmTransferOwner,
    onUnblockMember,
    onUpdateMemberRole,
    onProcessJoinRequest,
}: GroupConversationPanelProps) {
    const members = useMemo(
        () =>
            sortMembers(
                (conversation.members ?? []).filter(
                    (member) => !member.status || member.status === "ACTIVE",
                ),
            ),
        [conversation.members],
    );

    const [isMemberListOpen, setIsMemberListOpen] = useState(false);
    const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] =
        useState(false);
    const [isBlockedListOpen, setIsBlockedListOpen] = useState(false);
    const [blockedMembers, setBlockedMembers] = useState<ConversationMember[]>([]);
    const [blockedMembersLoading, setBlockedMembersLoading] = useState(false);
    const [hoveredMemberId, setHoveredMemberId] = useState<number | null>(null);
    const [activeMenuMemberId, setActiveMenuMemberId] = useState<number | null>(
        null,
    );
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setActiveMenuMemberId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const memberCount = members.length;
    const currentUserMember = members.find((m) => m.userId === currentUserId);
    const isOwner = currentUserMember?.role === "OWNER";
    const canReviewJoinRequests =
        currentUserMember?.role === "OWNER" ||
        currentUserMember?.role === "DEPUTY";
    const pendingRequests = useMemo(
        () =>
            canReviewJoinRequests
                ? (conversation.pendingRequests ?? []).filter(
                      (request) => request.status === "PENDING",
                  )
                : [],
        [canReviewJoinRequests, conversation.pendingRequests],
    );
    const pendingRequestCount = pendingRequests.length;

    const loadBlockedMembers = async () => {
        if (!canReviewJoinRequests) return;
        setBlockedMembersLoading(true);
        try {
            setBlockedMembers(await onGetBlockedMembers());
        } finally {
            setBlockedMembersLoading(false);
        }
    };

    useEffect(() => {
        if (!isBlockedListOpen) return;
        void loadBlockedMembers();
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ conversationId?: number }>).detail;
            if (Number(detail?.conversationId) === Number(conversation.id)) {
                void loadBlockedMembers();
            }
        };
        window.addEventListener("conversation-blocked-members-updated", handler);
        return () => window.removeEventListener("conversation-blocked-members-updated", handler);
    }, [conversation.id, isBlockedListOpen]);

    const renderJoinRequestItem = (request: JoinRequest) => {
        const isProcessing = pendingJoinRequestId === request.id;
        const requestAvatarUrl =
            buildS3Url(request.userAvatar) ||
            request.userAvatar ||
            DEFAULT_AVATAR_URL;

        return (
            <div key={request.id} className="flex gap-3 py-3">
                <img
                    src={requestAvatarUrl}
                    alt={request.userName || "Thành viên"}
                    onError={(event) => {
                        event.currentTarget.src = DEFAULT_AVATAR_URL;
                    }}
                    className="h-11 w-11 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {request.userName || "Thành viên"}
                    </p>
                    {request.inviterName && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            Được mời bởi: {request.inviterName}
                        </p>
                    )}
                    {formatRelativeTime(request.createdAt) && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Clock size={12} />
                            {formatRelativeTime(request.createdAt)}
                        </p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() =>
                                void onProcessJoinRequest(request.id, false)
                            }
                            className="rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#262626] dark:text-gray-100 dark:hover:bg-[#333333]"
                        >
                            Từ chối
                        </button>
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() =>
                                void onProcessJoinRequest(request.id, true)
                            }
                            className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-900/25 dark:text-blue-300 dark:hover:bg-blue-900/35"
                        >
                            Đồng ý
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <section className="py-3">
            <div className="group relative rounded-xl border border-transparent px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                        Thành viên
                    </h3>
                    <ChevronDown size={18} className="text-gray-500" />
                </div>

                <button
                    type="button"
                    onClick={() => setIsMemberListOpen(true)}
                    className="mt-4 flex w-full items-center gap-3 text-left"
                >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#262626]">
                        <Users
                            size={20}
                            className="text-gray-600 dark:text-gray-300"
                        />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {memberCount} thành viên
                    </span>
                </button>
                {canReviewJoinRequests && pendingRequestCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setIsJoinRequestModalOpen(true)}
                        className="ml-[3.25rem] mt-1 block text-left text-sm font-medium text-blue-600 dark:text-blue-400"
                    >
                        • Có {pendingRequestCount} yêu cầu tham gia nhóm
                    </button>
                )}
            </div>

            {isJoinRequestModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 pt-16 transition-opacity">
                    <div className="flex h-[430px] w-full max-w-md flex-col rounded-md bg-white shadow-2xl dark:bg-[#111111]">
                        <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4 dark:border-[#262626]">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                                Các yêu cầu cần được phê duyệt
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsJoinRequestModalOpen(false)}
                                className="rounded-full p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#262626]"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-3">
                            {pendingRequestCount > 0 ? (
                                pendingRequests.map(renderJoinRequestItem)
                            ) : (
                                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Không có yêu cầu đang chờ.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isMemberListOpen && (
                <div className="fixed inset-0 z-[60] flex justify-end bg-black/50 transition-opacity">
                    <div className="flex h-full w-full max-w-md flex-col bg-white animate-in slide-in-from-right duration-300 dark:bg-[#111111]">
                        <div className="flex h-14 items-center border-b border-gray-100 px-4 dark:border-[#262626]">
                            <button
                                type="button"
                                onClick={() => setIsMemberListOpen(false)}
                                className="mr-2 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-[#262626]"
                            >
                                <ArrowLeft
                                    size={20}
                                    className="text-gray-700 dark:text-gray-300"
                                />
                            </button>
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                Thành viên
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {canManageMembers && (
                                    <button
                                        type="button"
                                        onClick={onOpenAddMembersModal}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200 dark:bg-[#262626] dark:text-white dark:hover:bg-[#333333]"
                                    >
                                        <UserPlus size={18} />
                                        Thêm thành viên
                                    </button>
                                )}
                                {canReviewJoinRequests && (
                                    <button
                                        type="button"
                                        onClick={() => setIsBlockedListOpen(true)}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                                    >
                                        <UserPlus size={18} />
                                        Danh sách chặn
                                    </button>
                                )}
                            </div>

                            {canReviewJoinRequests && pendingRequestCount > 0 && (
                                <div className="mt-5 border-b border-gray-200 pb-4 dark:border-[#262626]">
                                    <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">
                                        Yêu cầu tham gia nhóm (
                                        {pendingRequestCount})
                                    </h3>
                                    <div className="space-y-1">
                                        {pendingRequests.map(
                                            renderJoinRequestItem,
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Danh sách thành viên ({memberCount})
                                    </h3>
                                    <MoreHorizontal
                                        size={18}
                                        className="cursor-pointer text-gray-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    {members.map((member) => {
                                        const isMe =
                                            member.userId === currentUserId;
                                        const canModerateMember =
                                            !isMe &&
                                            (isOwner ||
                                                (canKickMembers &&
                                                    member.role === "MEMBER"));
                                        const canShowMenu =
                                            isMe || canModerateMember;

                                        return (
                                            <div
                                                key={member.userId}
                                                onMouseEnter={() =>
                                                    setHoveredMemberId(
                                                        member.userId,
                                                    )
                                                }
                                                onMouseLeave={() =>
                                                    setHoveredMemberId(null)
                                                }
                                                className="relative flex items-center justify-between rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-[#1a1a1a]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <img
                                                            src={
                                                                member.accountLocked
                                                                    ? LOCKED_ACCOUNT_AVATAR_URL
                                                                    : member.avatar ||
                                                                      DEFAULT_AVATAR_URL
                                                            }
                                                            alt={
                                                                member.accountLocked
                                                                    ? LOCKED_ACCOUNT_NAME
                                                                    : member.nickname
                                                            }
                                                            className="h-10 w-10 rounded-full object-cover"
                                                        />
                                                        {member.role ===
                                                            "OWNER" && (
                                                            <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100 dark:bg-[#111111] dark:ring-[#262626]">
                                                                <Crown
                                                                    size={10}
                                                                    className="text-amber-500"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                            {isMe
                                                                ? "Bạn"
                                                                : member.accountLocked
                                                                  ? LOCKED_ACCOUNT_NAME
                                                                  : member.nickname ||
                                                                    "Người dùng"}
                                                        </p>
                                                        {member.role ===
                                                            "OWNER" && (
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                Trưởng nhóm
                                                            </p>
                                                        )}
                                                        {member.role ===
                                                            "DEPUTY" && (
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                Phó nhóm
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {canShowMenu &&
                                                    (hoveredMemberId ===
                                                        member.userId ||
                                                        activeMenuMemberId ===
                                                            member.userId) && (
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuMemberId(
                                                                        member.userId,
                                                                    );
                                                                }}
                                                                className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-[#333333]"
                                                            >
                                                                <MoreHorizontal
                                                                    size={18}
                                                                    className="text-gray-600 dark:text-gray-400"
                                                                />
                                                            </button>

                                                            {activeMenuMemberId ===
                                                                member.userId && (
                                                                <div
                                                                    ref={
                                                                        menuRef
                                                                    }
                                                                    className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl bg-white p-1.5 shadow-2xl ring-1 ring-black/5 dark:bg-[#262626]"
                                                                >
                                                                    {isMe ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setActiveMenuMemberId(
                                                                                    null,
                                                                                );
                                                                                void onLeaveGroup();
                                                                            }}
                                                                            className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#333333]"
                                                                        >
                                                                            Rời
                                                                            nhóm
                                                                        </button>
                                                                    ) : canModerateMember ? (
                                                                        <div className="flex flex-col">
                                                                            {isOwner ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setActiveMenuMemberId(
                                                                                            null,
                                                                                        );
                                                                                        onOpenConfirmTransferOwner(
                                                                                            member.userId,
                                                                                        );
                                                                                    }}
                                                                                    className="flex w-full items-center whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#333333]"
                                                                                >
                                                                                    Chuyển trưởng nhóm
                                                                                </button>
                                                                            ) : null}

                                                                            {isOwner && member.role ===
                                                                            "MEMBER" ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setActiveMenuMemberId(
                                                                                            null,
                                                                                        );
                                                                                        void onUpdateMemberRole(
                                                                                            member.userId,
                                                                                            "DEPUTY",
                                                                                        );
                                                                                    }}
                                                                                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#333333]"
                                                                                >
                                                                                    Thêm
                                                                                    phó
                                                                                    nhóm
                                                                                </button>
                                                                            ) : isOwner && member.role ===
                                                                              "DEPUTY" ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setActiveMenuMemberId(
                                                                                            null,
                                                                                        );
                                                                                        void onUpdateMemberRole(
                                                                                            member.userId,
                                                                                            "MEMBER",
                                                                                        );
                                                                                    }}
                                                                                    className="flex w-full items-center rounded-lg py-2 pl-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#333333]"
                                                                                >
                                                                                    Gỡ
                                                                                    quyền
                                                                                    phó
                                                                                    nhóm
                                                                                </button>
                                                                            ) : null}

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setActiveMenuMemberId(
                                                                                        null,
                                                                                    );
                                                                                    onOpenConfirmKick(member.userId);
                                                                                }}
                                                                                className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                                            >
                                                                                Xóa
                                                                                khỏi
                                                                                nhóm
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setActiveMenuMemberId(null);
                                                                                    onOpenConfirmBlock(member.userId);
                                                                                }}
                                                                                className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                                                                            >
                                                                                Chặn khỏi nhóm
                                                                            </button>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isBlockedListOpen && (
                <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 pt-16">
                    <div className="flex h-[430px] w-full max-w-md flex-col rounded-md bg-white shadow-2xl dark:bg-[#111111]">
                        <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4 dark:border-[#262626]">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                                Danh sách chặn
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsBlockedListOpen(false)}
                                className="rounded-full p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#262626]"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-3">
                            {blockedMembersLoading ? (
                                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Đang tải...
                                </p>
                            ) : blockedMembers.length === 0 ? (
                                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Chưa có ai bị chặn khỏi nhóm.
                                </p>
                            ) : (
                                blockedMembers.map((member) => (
                                    <div key={member.userId} className="flex items-center gap-3 py-2">
                                        <img
                                            src={member.avatar || DEFAULT_AVATAR_URL}
                                            alt={member.nickname || "Thành viên"}
                                            className="h-10 w-10 rounded-full object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                {member.nickname || member.username || "Thành viên"}
                                            </p>
                                            {member.blockedAt && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatRelativeTime(member.blockedAt)}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const success = await onUnblockMember(member.userId);
                                                if (success) void loadBlockedMembers();
                                            }}
                                            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-200 dark:bg-[#262626] dark:text-gray-100 dark:hover:bg-[#333333]"
                                        >
                                            Bỏ chặn
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <TransferOwnershipModal
                open={isTransferOwnerModalOpen}
                members={ownerTransferCandidates}
                submitting={isLeavingGroup}
                pendingUserId={pendingTransferOwnerUserId}
                error={actionError}
                onClose={onCloseTransferOwnerModal}
                onSubmit={onTransferOwnershipAndLeave}
            />
        </section>
    );
}
