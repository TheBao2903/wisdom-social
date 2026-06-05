import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
    ArrowLeft,
    Copy,
    Download,
    Link2,
    MoreHorizontal,
    QrCode,
    RefreshCw,
    Share2,
    Unlink,
} from "lucide-react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import chatService, { type Conversation } from "../../services/chatService";
import ConversationAvatar from "./ConversationAvatar";
import { DEFAULT_GROUP_AVATAR_URL } from "../../constants/ui";
import ConfirmModal from "./ConfirmModal";

interface InviteLinkModalProps {
    open: boolean;
    conversation: Conversation;
    canManageInviteLink: boolean;
    onClose: () => void;
    onChanged?: () => Promise<void> | void;
}

export default function InviteLinkModal({
    open,
    conversation,
    canManageInviteLink,
    onClose,
    onChanged,
}: InviteLinkModalProps) {
    const [inviteTokenOverride, setInviteTokenOverride] = useState<
        string | null | undefined
    >(undefined);
    const [fetchedInviteToken, setFetchedInviteToken] = useState<
        string | null | undefined
    >(undefined);
    const [qrDataUrl, setQrDataUrl] = useState("");
    const [loadingAction, setLoadingAction] = useState<
        "create" | "reset" | "disable" | null
    >(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDisableConfirmOpen, setIsDisableConfirmOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const inviteToken =
        inviteTokenOverride === undefined
            ? (fetchedInviteToken ?? conversation.inviteToken ?? null)
            : inviteTokenOverride;

    const inviteUrl = useMemo(() => {
        if (!inviteToken) return "";
        return `${window.location.origin}/g/${inviteToken}`;
    }, [inviteToken]);

    useEffect(() => {
        if (!inviteUrl) return;

        let cancelled = false;
        QRCode.toDataURL(inviteUrl, {
            width: 320,
            margin: 1,
            errorCorrectionLevel: "M",
        })
            .then((url) => {
                if (!cancelled) setQrDataUrl(url);
            })
            .catch(() => {
                if (!cancelled) setQrDataUrl("");
            });

        return () => {
            cancelled = true;
        };
    }, [inviteUrl]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        chatService
            .getConversation(conversation.id, 0)
            .then((response) => {
                if (cancelled || !response.success || !response.data) return;
                setFetchedInviteToken(response.data.inviteToken ?? null);
            })
            .catch(() => {
                if (!cancelled) setFetchedInviteToken(conversation.inviteToken ?? null);
            });

        return () => {
            cancelled = true;
        };
    }, [
        conversation.id,
        conversation.inviteToken,
        conversation.lastMessage?.lastMessageAt,
        conversation.lastMessage?.lastMessageContent,
        conversation.lastMessage?.lastMessageType,
        open,
    ]);

    useEffect(() => {
        if (!isMenuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current?.contains(event.target as Node)) return;
            setIsMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen]);

    if (!open) return null;

    const runAndRefresh = async (nextToken: string | null) => {
        setInviteTokenOverride(nextToken);
        setFetchedInviteToken(nextToken);
        await onChanged?.();
    };

    const handleCreate = async () => {
        if (!canManageInviteLink) return;
        try {
            setLoadingAction("create");
            const token = await chatService.getOrCreateInviteLink(
                conversation.id,
            );
            await runAndRefresh(token);
        } catch {
            toast.error("Không thể tạo link tham gia nhóm.");
        } finally {
            setLoadingAction(null);
        }
    };

    const handleReset = async () => {
        if (!canManageInviteLink) return;
        try {
            setLoadingAction("reset");
            const token = await chatService.resetInviteLink(conversation.id);
            setIsMenuOpen(false);
            await runAndRefresh(token);
            toast.success("Đã đổi link tham gia nhóm.");
        } catch {
            toast.error("Không thể đổi link tham gia nhóm.");
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDisable = async () => {
        if (!canManageInviteLink) return;

        try {
            setLoadingAction("disable");
            await chatService.disableInviteLink(conversation.id);
            setIsMenuOpen(false);
            setIsDisableConfirmOpen(false);
            await runAndRefresh(null);
            toast.success("Đã khóa link tham gia nhóm.");
        } catch {
            toast.error("Không thể khóa link tham gia nhóm.");
        } finally {
            setLoadingAction(null);
        }
    };

    const handleCopy = async () => {
        if (!inviteUrl) return;
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Đã sao chép link.");
    };

    const handleShare = async () => {
        if (!inviteUrl) return;
        if (navigator.share) {
            await navigator.share({
                title: conversation.name || "Link tham gia nhóm",
                text: "Mời bạn tham gia nhóm",
                url: inviteUrl,
            });
            return;
        }
        await handleCopy();
    };

    const handleDownloadQr = () => {
        if (!qrDataUrl) return;
        const anchor = document.createElement("a");
        anchor.href = qrDataUrl;
        anchor.download = `group-invite-${conversation.id}.png`;
        anchor.click();
    };

    return (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/50 transition-opacity">
            <div className="flex h-full w-full max-w-md flex-col bg-white animate-in slide-in-from-right duration-300 dark:bg-[#111111]">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4 dark:border-[#262626]">
                    <div className="flex items-center">
                        <button
                            type="button"
                            onClick={onClose}
                            className="mr-2 rounded-full p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#262626]"
                        >
                            <ArrowLeft size={22} />
                        </button>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                            Link nhóm
                        </h2>
                    </div>
                    {inviteToken && canManageInviteLink && (
                        <div className="relative" ref={menuRef}>
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen((prev) => !prev)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#262626]"
                            >
                                <MoreHorizontal size={22} />
                            </button>
                            {isMenuOpen && (
                                <div className="absolute right-0 top-10 z-10 w-44 rounded-md bg-white p-1.5 shadow-xl ring-1 ring-black/10 dark:bg-[#262626]">
                                    <button
                                        type="button"
                                        disabled={loadingAction !== null}
                                        onClick={handleReset}
                                        className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-100 dark:hover:bg-[#333333]"
                                    >
                                        <RefreshCw size={16} />
                                        Đổi link
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loadingAction !== null}
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            setIsDisableConfirmOpen(true);
                                        }}
                                        className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        <Unlink size={16} />
                                        Khóa link
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!inviteToken ? (
                    <div className="flex flex-1 flex-col items-center justify-start px-8 pt-20 text-center">
                            <div className="mb-10 flex items-center justify-center">
                                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-blue-300 dark:bg-blue-950/30 dark:text-blue-400">
                                    <QrCode size={38} />
                                </span>
                                <span className="-ml-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-[#1a1a1a] dark:text-gray-500">
                                    <Link2 size={38} />
                                </span>
                            </div>
                            <p className="text-xl font-medium leading-snug text-gray-500 dark:text-gray-300">
                                Mời bất kỳ ai vào nhóm mà không cần kết bạn
                            </p>
                            {canManageInviteLink && (
                                <button
                                    type="button"
                                    disabled={loadingAction !== null}
                                    onClick={handleCreate}
                                    className="mt-12 h-12 w-full rounded-full bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loadingAction === "create"
                                        ? "Đang tạo..."
                                        : "Tạo ngay"}
                                </button>
                            )}
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <div className="px-6 py-7 text-center">
                            <ConversationAvatar
                                name={conversation.name || "Nhóm"}
                                avatarUrl={conversation.imageUrl}
                                fallbackAvatarUrl={DEFAULT_GROUP_AVATAR_URL}
                                sizeClassName="mx-auto mb-5 h-24 w-24"
                                ringClassName="ring-1 ring-gray-200 dark:ring-[#262626]"
                            />
                            <h3 className="text-2xl font-bold text-gray-950 dark:text-white">
                                {conversation.name || "Nhóm chat"}
                            </h3>
                            <p className="mx-auto mt-3 max-w-xs text-base leading-relaxed text-gray-500 dark:text-gray-400">
                                Mời mọi người tham gia nhóm bằng mã QR hoặc link
                                dưới đây:
                            </p>

                            <div className="mx-auto mt-8 flex h-72 w-72 max-w-full items-center justify-center bg-white">
                                {qrDataUrl ? (
                                    <img
                                        src={qrDataUrl}
                                        alt="Mã QR link tham gia nhóm"
                                        className="h-full w-full object-contain"
                                    />
                                ) : (
                                    <QrCode
                                        size={52}
                                        className="text-gray-300"
                                    />
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleCopy}
                                className="mx-auto mt-5 block max-w-full truncate rounded-md bg-gray-100 px-5 py-3 text-base font-semibold text-blue-600 transition-colors hover:bg-gray-200 dark:bg-[#1a1a1a] dark:text-blue-300 dark:hover:bg-[#262626]"
                            >
                                {inviteUrl.replace(/^https?:\/\//, "")}
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-t border-gray-100 px-3 py-5 dark:border-[#262626]">
                            <InviteAction
                                icon={<Copy size={22} />}
                                label="Sao chép link"
                                onClick={handleCopy}
                            />
                            <InviteAction
                                icon={<Share2 size={22} />}
                                label="Chia sẻ link"
                                onClick={handleShare}
                            />
                            <InviteAction
                                icon={<Download size={22} />}
                                label="Lưu mã QR"
                                onClick={handleDownloadQr}
                            />
                        </div>
                    </div>
                )}
                <ConfirmModal
                    open={isDisableConfirmOpen}
                    title="Khóa link tham gia nhóm?"
                    description="Link hiện tại và mã QR sẽ không còn dùng được. Người đã nhận link này sẽ không thể dùng nó để vào nhóm."
                    confirmLabel="Khóa link"
                    loading={loadingAction === "disable"}
                    isDanger
                    onClose={() => setIsDisableConfirmOpen(false)}
                    onConfirm={() => {
                        void handleDisable();
                    }}
                />
            </div>
        </div>
    );
}

function InviteAction({
    icon,
    label,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-center gap-3 text-sm font-medium text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-300"
        >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-[#262626]">
                {icon}
            </span>
            <span>{label}</span>
        </button>
    );
}
