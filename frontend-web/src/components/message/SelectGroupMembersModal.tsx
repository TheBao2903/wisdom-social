import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import type { User } from "../../types";
import { DEFAULT_AVATAR_URL } from "../../constants/ui";
import chatService, { type ChatUserSearchResult } from "../../services/chatService";

interface SelectGroupMembersModalProps {
    open: boolean;
    friends: User[];
    existingMemberIds: Set<number>;
    loadingFriends: boolean;
    friendsError: string | null;
    submitting: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (memberIds: number[], inviteeUserIds?: number[]) => Promise<boolean>;
}

function getDisplayName(friend: User): string {
    return friend.fullName || friend.name || friend.username;
}

export default function SelectGroupMembersModal({
    open,
    friends,
    existingMemberIds,
    loadingFriends,
    friendsError,
    submitting,
    error,
    onClose,
    onSubmit,
}: SelectGroupMembersModalProps) {
    const [searchKeyword, setSearchKeyword] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedInvitees, setSelectedInvitees] = useState<ChatUserSearchResult[]>([]);
    const [phoneSearchResult, setPhoneSearchResult] = useState<ChatUserSearchResult | null>(null);
    const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);

    useEffect(() => {
        if (!open) {
            setSearchKeyword("");
            setSelectedIds([]);
            setSelectedInvitees([]);
            setPhoneSearchResult(null);
            setPhoneSearchLoading(false);
        }
    }, [open]);

    const addableFriends = useMemo(
        () => friends.filter((friend) => !existingMemberIds.has(Number(friend.id))),
        [existingMemberIds, friends],
    );

    const filteredFriends = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) {
            return addableFriends;
        }

        return addableFriends.filter((friend) => {
            const searchable = [getDisplayName(friend), friend.username].join(
                " ",
            );
            return searchable.toLowerCase().includes(keyword);
        });
    }, [addableFriends, searchKeyword]);

    const phoneSearchDigits = searchKeyword.replace(/\D/g, "");
    useEffect(() => {
        if (phoneSearchDigits.length !== 10) {
            setPhoneSearchResult(null);
            setPhoneSearchLoading(false);
            return;
        }
        let cancelled = false;
        setPhoneSearchLoading(true);
        chatService.searchChatUserByPhone(phoneSearchDigits)
            .then((result) => {
                if (!cancelled) setPhoneSearchResult(result);
            })
            .catch(() => {
                if (!cancelled) setPhoneSearchResult(null);
            })
            .finally(() => {
                if (!cancelled) setPhoneSearchLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [phoneSearchDigits]);

    const handleToggle = (userId: number) => {
        setSelectedIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId],
        );
    };

    const clearSearch = () => {
        setSearchKeyword("");
        setPhoneSearchResult(null);
        setPhoneSearchLoading(false);
    };

    const selectedInviteeIds = selectedInvitees.map((user) => user.userId);

    const handleToggleSearchResult = (result: ChatUserSearchResult) => {
        if (existingMemberIds.has(Number(result.userId))) return;
        if (result.friendStatus === "FRIEND") {
            handleToggle(result.userId);
            clearSearch();
            return;
        }
        setSelectedInvitees((prev) =>
            prev.some((user) => user.userId === result.userId)
                ? prev.filter((user) => user.userId !== result.userId)
                : [...prev, result],
        );
        clearSearch();
    };

    const removeInvitee = (userId: number) => {
        setSelectedInvitees((prev) => prev.filter((user) => user.userId !== userId));
    };

    const handleSubmit = async () => {
        if ((selectedIds.length === 0 && selectedInviteeIds.length === 0) || submitting) {
            return;
        }

        await onSubmit(selectedIds, selectedInviteeIds);
    };

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-95 flex items-center justify-center bg-black/55 px-4 py-6">
            <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#303030] dark:bg-[#111111]">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-[#2a2a2a]">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Thêm thành viên vào nhóm
                        </h2>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Chọn bạn bè chưa có trong nhóm để thêm nhanh.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#232323] dark:hover:text-gray-100"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <div className="relative">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            value={searchKeyword}
                            onChange={(event) =>
                                setSearchKeyword(event.target.value)
                            }
                            placeholder="Tìm bạn bè"
                            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-10 text-sm text-gray-900 outline-none focus:border-blue-400 dark:border-[#2f2f2f] dark:bg-[#171717] dark:text-white"
                        />
                        {searchKeyword && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#242424] dark:hover:text-gray-200"
                                aria-label="Xoa tim kiem"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {phoneSearchLoading && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Dang tim nguoi dung theo so dien thoai...
                        </p>
                    )}
                    {phoneSearchResult && !existingMemberIds.has(Number(phoneSearchResult.userId)) && (
                        <button
                            type="button"
                            onClick={() => handleToggleSearchResult(phoneSearchResult)}
                            className="mt-2 flex w-full items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                        >
                            <img
                                src={phoneSearchResult.avatarUrl || DEFAULT_AVATAR_URL}
                                onError={(event) => {
                                    event.currentTarget.src = DEFAULT_AVATAR_URL;
                                }}
                                alt={phoneSearchResult.name}
                                className="h-9 w-9 rounded-full object-cover"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                    {phoneSearchResult.name}
                                </p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                    {phoneSearchResult.friendStatus === "FRIEND"
                                        ? "Ban be - them truc tiep"
                                        : "Nguoi la - gui link moi"}
                                </p>
                            </div>
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-[#111] dark:text-blue-200 dark:ring-blue-900">
                                {phoneSearchResult.friendStatus === "FRIEND"
                                    ? selectedIds.includes(phoneSearchResult.userId)
                                        ? "Da chon"
                                        : "Chon"
                                    : selectedInviteeIds.includes(phoneSearchResult.userId)
                                      ? "Da moi"
                                      : "Moi link"}
                            </span>
                        </button>
                    )}
                    {selectedInvitees.length > 0 && (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#2f2f2f] dark:bg-[#171717]">
                            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                Nguoi la se nhan link moi
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {selectedInvitees.map((user) => (
                                    <span
                                        key={user.userId}
                                        className="inline-flex max-w-[220px] items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm font-medium text-gray-800 dark:border-[#333] dark:bg-[#202020] dark:text-gray-100"
                                    >
                                        <img
                                            src={user.avatarUrl || DEFAULT_AVATAR_URL}
                                            onError={(event) => {
                                                event.currentTarget.src = DEFAULT_AVATAR_URL;
                                            }}
                                            alt={user.name}
                                            className="h-7 w-7 rounded-full object-cover"
                                        />
                                        <span className="truncate">{user.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeInvitee(user.userId)}
                                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-gray-500 hover:bg-slate-200 hover:text-gray-800 dark:bg-[#2b2b2b] dark:hover:bg-[#363636] dark:hover:text-white"
                                            aria-label={`Bo moi ${user.name}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto border-y border-gray-200 px-5 py-3 dark:border-[#2a2a2a]">
                    {loadingFriends ? (
                        <div className="flex items-center justify-center py-10 text-sm text-gray-500 dark:text-gray-400">
                            <Loader2 size={16} className="mr-2 animate-spin" />
                            Đang tải danh sách bạn bè...
                        </div>
                    ) : friendsError ? (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                            {friendsError}
                        </p>
                    ) : filteredFriends.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                            <UserPlus size={18} />
                            Không có bạn bè khả dụng để thêm.
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredFriends.map((friend) => {
                                const checked = selectedIds.includes(friend.id);
                                return (
                                    <label
                                        key={friend.id}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                            checked
                                                ? "border-blue-200 bg-blue-50 dark:border-blue-700/60 dark:bg-blue-900/20"
                                                : "border-gray-200 hover:bg-gray-50 dark:border-[#2f2f2f] dark:hover:bg-[#1a1a1a]"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                                handleToggle(friend.id)
                                            }
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <img
                                            src={
                                                friend.avatarUrl ||
                                                DEFAULT_AVATAR_URL
                                            }
                                            onError={(event) => {
                                                event.currentTarget.src =
                                                    DEFAULT_AVATAR_URL;
                                            }}
                                            alt={getDisplayName(friend)}
                                            className="h-9 w-9 rounded-full object-cover"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                                {getDisplayName(friend)}
                                            </p>
                                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                @{friend.username}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-3 px-5 py-4">
                    {error && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                            {error}
                        </p>
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Đã chọn {selectedIds.length} người, {selectedInviteeIds.length} người nhận link
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-[#2f2f2f] dark:text-gray-200 dark:hover:bg-[#1b1b1b]"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSubmit()}
                                disabled={
                                    (selectedIds.length === 0 && selectedInviteeIds.length === 0) || submitting
                                }
                                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                            >
                                {submitting && (
                                    <Loader2
                                        size={15}
                                        className="mr-2 animate-spin"
                                    />
                                )}
                                Thêm thành viên
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
