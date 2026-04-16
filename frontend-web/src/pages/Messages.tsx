import { useState, useRef, useEffect, useCallback } from "react";
import {
    Search,
    Edit,
    MailOpen,
    BellOff,
    User,
    Ban,
    Archive,
    Trash2,
    Flag,
    MoreHorizontal,
    ChevronDown,
    ChevronUp,
    CircleUserRound,
    Bell,
    Pin,
    Palette,
    ThumbsUp,
    Type,
    Images,
    FileText,
    Eye,
    Lock,
    TimerReset,
    EyeOff,
    X,
} from "lucide-react";
import ChatWindow from "../components/message/ChatWindow";
import { useMessagesController } from "../hooks/useMessagesController";
import chatService from "../services/chatService";
import { useSidebarLayout } from "../hooks/useSidebarLayout";

type DetailSectionKey = "chatInfo" | "customize" | "media" | "privacy";

export default function Messages() {
    const INFO_PANEL_WIDTH = 352;
    const { sidebarWidth } = useSidebarLayout();
    const {
        searchQuery,
        setSearchQuery,
        loading,
        error,
        selectedConversationId,
        currentUserId,
        conversations,
        filteredConversations,
        handleSelectConversation,
        handleDeleteConversationForMe,
        getDisplayInfo,
        formatTime,
        clearUnreadCount,
    } = useMessagesController();

    // State để track conversation nào đang mở menu
    const [openMenuConvId, setOpenMenuConvId] = useState<number | null>(null);
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [isInfoPanelRendered, setIsInfoPanelRendered] = useState(false);
    const [expandedSections, setExpandedSections] = useState<
        Record<DetailSectionKey, boolean>
    >({
        chatInfo: true,
        customize: true,
        media: true,
        privacy: true,
    });
    const menuRef = useRef<HTMLDivElement>(null);

    const selectedConversation =
        conversations.find((conv) => conv.id === selectedConversationId) ||
        null;
    const selectedDisplayInfo = selectedConversation
        ? getDisplayInfo(selectedConversation)
        : null;

    const selectedStatus = selectedConversation?.lastMessage?.lastMessageAt
        ? `Hoạt động ${formatTime(selectedConversation.lastMessage.lastMessageAt)} trước`
        : "Đang hoạt động gần đây";

    const toggleDetailSection = useCallback((key: DetailSectionKey) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleChangeNickname = useCallback(async () => {
        if (!selectedConversationId || !selectedConversation) return;

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
        }
    }, [selectedConversationId]);

    const handleDeleteConversation = useCallback(
        (convId: number) => {
            setOpenMenuConvId(null);
            void handleDeleteConversationForMe(convId);
        },
        [handleDeleteConversationForMe],
    );

    const handleToggleInfoPanel = useCallback(() => {
        if (!selectedConversationId) {
            return;
        }
        setShowInfoPanel((prev) => !prev);
    }, [selectedConversationId]);

    const handleCloseInfoPanel = useCallback(() => {
        setShowInfoPanel(false);
    }, []);

    const menuItemBase =
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-[#363636]";

    const detailSectionButtonClass =
        "flex w-full items-center justify-between rounded-md px-1.5 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800";

    const detailActionButtonClass =
        "flex w-full items-center gap-3 rounded-md px-1.5 py-2 text-left text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800";

    const infoPanelContent = (
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
                    <img
                        src={selectedDisplayInfo?.avatar}
                        alt={selectedDisplayInfo?.name}
                        className="mb-3 h-20 w-20 rounded-full object-cover ring-1 ring-gray-200 dark:ring-[#242424]"
                    />
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
                        <button className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                                <CircleUserRound size={16} />
                            </span>
                            Trang cá nhân
                        </button>
                        <button className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                                <Bell size={16} />
                            </span>
                            Tắt thông báo
                        </button>
                        <button className="flex flex-col items-center gap-1.5 rounded-md px-2 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-900">
                                <Search size={16} />
                            </span>
                            Tìm kiếm
                        </button>
                    </div>
                </div>

                <div className="h-px bg-gray-200 dark:bg-[#262626]" />

                <div className="space-y-0">
                    <section className="py-2">
                        <button
                            type="button"
                            onClick={() => toggleDetailSection("chatInfo")}
                            className={detailSectionButtonClass}
                        >
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                Thông tin về đoạn chat
                            </span>
                            {expandedSections.chatInfo ? (
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
                        {expandedSections.chatInfo && (
                            <div className="pb-1">
                                <button className={detailActionButtonClass}>
                                    <Pin size={18} />
                                    <span>Xem tin nhắn đã ghim</span>
                                </button>
                            </div>
                        )}
                    </section>

                    <div className="h-px bg-gray-200 dark:bg-[#262626]" />

                    <section className="py-2">
                        <button
                            type="button"
                            onClick={() => toggleDetailSection("customize")}
                            className={detailSectionButtonClass}
                        >
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                Tùy chỉnh đoạn chat
                            </span>
                            {expandedSections.customize ? (
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
                        {expandedSections.customize && (
                            <div className="pb-1">
                                <button className={detailActionButtonClass}>
                                    <Palette size={18} />
                                    <span>Đổi chủ đề</span>
                                </button>
                                <button className={detailActionButtonClass}>
                                    <ThumbsUp size={18} />
                                    <span>Thay đổi biểu tượng cảm xúc</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleChangeNickname()}
                                    className={detailActionButtonClass}
                                >
                                    <Type size={18} />
                                    <span>Chỉnh sửa biệt danh</span>
                                </button>
                            </div>
                        )}
                    </section>

                    <div className="h-px bg-gray-200 dark:bg-[#262626]" />

                    <section className="py-2">
                        <button
                            type="button"
                            onClick={() => toggleDetailSection("media")}
                            className={detailSectionButtonClass}
                        >
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                File phương tiện & file
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
                                <button className={detailActionButtonClass}>
                                    <Images size={18} />
                                    <span>File phương tiện</span>
                                </button>
                                <button className={detailActionButtonClass}>
                                    <FileText size={18} />
                                    <span>File</span>
                                </button>
                            </div>
                        )}
                    </section>

                    <div className="h-px bg-gray-200 dark:bg-[#262626]" />

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
                                    <Eye size={18} />
                                    <span>Quyền nhắn tin</span>
                                </button>
                                <button className={detailActionButtonClass}>
                                    <TimerReset size={18} />
                                    <span>Tin nhắn tự hủy</span>
                                </button>
                                <button className="flex w-full items-start justify-between gap-3 rounded-md px-1.5 py-2 text-left text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800">
                                    <div className="flex items-center gap-3">
                                        <Eye size={18} />
                                        <div>
                                            <p>Thông báo đã đọc</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Bật
                                            </p>
                                        </div>
                                    </div>
                                </button>
                                <button className={detailActionButtonClass}>
                                    <Lock size={18} />
                                    <span>Xác minh mã hóa đầu cuối</span>
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
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </>
    );

    return (
        <div
            className="fixed inset-0 bottom-16 left-0 flex overflow-hidden border-r border-gray-200/80 bg-gradient-to-b from-[#f8fafd] to-[#f2f5fa] dark:border-[#262626] dark:from-black dark:to-black md:bottom-0"
            style={{ left: `${sidebarWidth}px` }}
        >
            {/* Left Sidebar - Chat List */}
            <div
                className={`flex w-full flex-col border-r border-gray-200/80 bg-white/95 backdrop-blur-sm transition-[width] duration-300 ease-out dark:border-[#262626] dark:bg-black ${
                    selectedConversationId
                        ? "md:w-[264px] lg:w-[284px]"
                        : "md:w-[300px] lg:w-[320px]"
                }`}
            >
                {/* Header */}
                <div className="border-b border-gray-200/80 p-4 dark:border-[#262626]">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                                Messages
                            </h2>
                        </div>
                        <button className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#262626] dark:hover:text-white">
                            <Edit size={20} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Tìm kiếm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-transparent bg-gray-100 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-200 focus:bg-white dark:bg-gray-900 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-900 dark:focus:bg-black"
                        />
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
                    {loading ? (
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
                            const isActive = selectedConversationId === conv.id;
                            const isMenuOpen = openMenuConvId === conv.id;

                            return (
                                <div
                                    key={conv.id}
                                    className="group/item relative"
                                >
                                    <div
                                        onClick={() =>
                                            handleSelectConversation(conv.id)
                                        }
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                                            isActive
                                                ? "border-blue-100 bg-blue-50/90 shadow-sm dark:border-[#262626] dark:bg-gray-900"
                                                : "border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-[#242424] dark:hover:bg-[#131313]"
                                        }`}
                                    >
                                        <div className="relative">
                                            <img
                                                src={displayInfo.avatar}
                                                alt={displayInfo.name}
                                                className="h-14 w-14 rounded-full object-cover ring-1 ring-gray-200 dark:ring-[#2a2a2a]"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                {displayInfo.name}
                                            </p>
                                            <p
                                                className={`truncate text-sm ${
                                                    conv.unreadCount &&
                                                    conv.unreadCount > 0
                                                        ? "font-semibold text-gray-900 dark:text-white"
                                                        : "text-gray-500 dark:text-gray-400"
                                                }`}
                                            >
                                                {conv.lastMessage
                                                    ?.lastMessageContent ? (
                                                    <>
                                                        {(conv.type ===
                                                            "GROUP" ||
                                                            conv.lastMessage
                                                                .lastSenderId ===
                                                                currentUserId) && (
                                                            <>
                                                                <span>
                                                                    {conv
                                                                        .lastMessage
                                                                        .lastSenderId ===
                                                                    currentUserId
                                                                        ? "Bạn"
                                                                        : conv
                                                                              .lastMessage
                                                                              .lastSenderName}
                                                                </span>
                                                                {" : "}
                                                            </>
                                                        )}
                                                        {
                                                            conv.lastMessage
                                                                .lastMessageContent
                                                        }
                                                    </>
                                                ) : (
                                                    "Bắt đầu trò chuyện"
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                {conv.lastMessage
                                                    ?.lastMessageContent
                                                    ? formatTime(
                                                          conv.lastMessage
                                                              .lastMessageAt,
                                                      )
                                                    : ""}
                                            </span>
                                            {(conv.unreadCount ?? 0) > 0 && (
                                                <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5">
                                                    <span className="text-xs text-white font-semibold">
                                                        {conv.unreadCount! > 99
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
                                                    isMenuOpen ? null : conv.id,
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

                                                <button
                                                    onClick={() =>
                                                        setOpenMenuConvId(null)
                                                    }
                                                    className={menuItemBase}
                                                >
                                                    <MailOpen
                                                        size={20}
                                                        className="text-gray-700 dark:text-gray-300"
                                                    />
                                                    <span className="dark:text-white">
                                                        Đánh dấu là chưa đọc
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setOpenMenuConvId(null)
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
                                                <button
                                                    onClick={() =>
                                                        setOpenMenuConvId(null)
                                                    }
                                                    className={menuItemBase}
                                                >
                                                    <User
                                                        size={20}
                                                        className="text-gray-700 dark:text-gray-300"
                                                    />
                                                    <span className="dark:text-white">
                                                        Xem trang cá nhân
                                                    </span>
                                                </button>

                                                {/* Separator */}
                                                <div className="my-1 border-t border-gray-200 dark:border-[#363636]" />

                                                <button
                                                    onClick={() =>
                                                        setOpenMenuConvId(null)
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
                                                        setOpenMenuConvId(null)
                                                    }
                                                    className={menuItemBase}
                                                >
                                                    <Archive
                                                        size={20}
                                                        className="text-gray-700 dark:text-gray-300"
                                                    />
                                                    <span className="dark:text-white">
                                                        Lưu trữ đoạn chat
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
                                                        setOpenMenuConvId(null)
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
                            className={`flex-1 min-w-0 transition-[margin] duration-300 ease-out ${showInfoPanel ? "xl:mr-[352px]" : "xl:mr-0"}`}
                        >
                            <ChatWindow
                                key={selectedConversationId}
                                conversationId={selectedConversationId}
                                userId={currentUserId}
                                onMarkAsRead={clearUnreadCount}
                                onToggleInfoPanel={handleToggleInfoPanel}
                                showInfoPanel={showInfoPanel}
                            />
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
                                className={`absolute inset-y-0 right-0 z-30 flex w-full max-w-[352px] flex-col overflow-hidden border-l border-gray-200 bg-[#fbfcfe] shadow-2xl transition-[transform,opacity] duration-300 ease-out dark:border-[#262626] dark:bg-black xl:hidden ${showInfoPanel ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
                            >
                                {infoPanelContent}
                            </aside>
                        )}
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
    );
}
