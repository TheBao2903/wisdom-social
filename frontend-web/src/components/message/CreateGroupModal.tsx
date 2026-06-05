import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Search, Users, X } from "lucide-react";
import type { User } from "../../types";
import { DEFAULT_AVATAR_URL } from "../../constants/ui";
import chatService, { type ChatUserSearchResult } from "../../services/chatService";

interface CreateGroupSubmitPayload {
    name: string;
    imageUrl?: string;
    memberIds: number[];
    inviteeUserIds?: number[];
}

interface CreateGroupModalProps {
    open: boolean;
    friends: User[];
    loadingFriends: boolean;
    friendsError: string | null;
    submitting: boolean;
    error: string | null;
    currentUserName?: string;
    onClose: () => void;
    onSubmit: (payload: CreateGroupSubmitPayload) => Promise<boolean>;
}

function getFriendDisplayName(friend: User): string {
    return friend.fullName || friend.name || friend.username;
}

export default function CreateGroupModal({
    open,
    friends,
    loadingFriends,
    friendsError,
    submitting,
    error,
    currentUserName,
    onClose,
    onSubmit,
}: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState("");
    const [groupImageFile, setGroupImageFile] = useState<File | null>(null);
    const [imageUploadError, setImageUploadError] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedInvitees, setSelectedInvitees] = useState<ChatUserSearchResult[]>([]);
    const [phoneSearchResult, setPhoneSearchResult] = useState<ChatUserSearchResult | null>(null);
    const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);

    const resetForm = () => {
        setGroupName("");
        setGroupImageFile(null);
        setImageUploadError(null);
        setImageUploading(false);
        setSearchKeyword("");
        setSelectedIds([]);
        setSelectedInvitees([]);
        setPhoneSearchResult(null);
        setPhoneSearchLoading(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const filteredFriends = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) {
            return friends;
        }

        return friends.filter((friend) => {
            const searchable = [
                getFriendDisplayName(friend),
                friend.username,
            ].join(" ");
            return searchable.toLowerCase().includes(keyword);
        });
    }, [friends, searchKeyword]);

    const phoneSearchDigits = searchKeyword.replace(/\D/g, "");

    useEffect(() => {
        if (phoneSearchDigits.length !== 10) {
            setPhoneSearchResult(null);
            setPhoneSearchLoading(false);
            return;
        }

        let cancelled = false;
        setPhoneSearchLoading(true);
        chatService
            .searchChatUserByPhone(phoneSearchDigits)
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

    const groupImagePreviewUrl = useMemo(() => {
        return groupImageFile ? URL.createObjectURL(groupImageFile) : "";
    }, [groupImageFile]);

    useEffect(() => {
        return () => {
            if (groupImagePreviewUrl) {
                URL.revokeObjectURL(groupImagePreviewUrl);
            }
        };
    }, [groupImagePreviewUrl]);

    const selectedInviteeIds = selectedInvitees.map((user) => user.userId);
    const selectedCount = selectedIds.length + selectedInviteeIds.length;
    const canSubmit =
        !submitting &&
        !imageUploading &&
        (selectedInviteeIds.length > 0
            ? selectedIds.length >= 1 && selectedCount >= 2
            : selectedIds.length >= 2);

    const toggleSelectedId = (userId: number) => {
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

    const togglePhoneSearchResult = (result: ChatUserSearchResult) => {
        if (result.friendStatus === "FRIEND") {
            toggleSelectedId(result.userId);
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
        if (!canSubmit) return;

        // 👉 nếu không nhập tên → tự generate
        let finalName = groupName.trim();

        if (!finalName) {
            const selectedFriends = friends.filter((f) =>
                selectedIds.includes(f.id),
            );

            finalName = [
                currentUserName?.trim(),
                ...selectedFriends.map((f) => getFriendDisplayName(f)),
            ]
                .filter((name): name is string => Boolean(name?.trim()))
                .join(", ");
        }

        let uploadedImageKey: string | undefined;

        setImageUploadError(null);
        if (groupImageFile) {
            try {
                setImageUploading(true);
                const { presignedUrl, objectKey } =
                    await chatService.getPresignedUrl(
                        "CONVERSATION",
                        "group-avatars",
                        "IMAGE",
                        groupImageFile.name,
                        groupImageFile.type || "image/jpeg",
                    );
                await chatService.uploadToS3(presignedUrl, groupImageFile);
                uploadedImageKey = objectKey;
            } catch {
                setImageUploadError("Khong the tai anh nhom len. Vui long thu lai.");
                return;
            } finally {
                setImageUploading(false);
            }
        }

        const created = await onSubmit({
            name: finalName,
            imageUrl: uploadedImageKey,
            memberIds: selectedIds,
            inviteeUserIds: selectedInviteeIds,
        });
        if (created) {
            resetForm();
        }
    };
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-95 flex items-center justify-center bg-black/55 px-4 py-6">
            <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#303030] dark:bg-[#111111]">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-[#2a2a2a]">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Tạo nhóm mới
                        </h2>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Chọn ít nhất 2 bạn bè để bắt đầu cuộc trò chuyện
                            nhóm.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#232323] dark:hover:text-gray-100"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-200">
                            <span className="font-medium">Tên nhóm</span>
                            <input
                                value={groupName}
                                onChange={(event) =>
                                    setGroupName(event.target.value)
                                }
                                placeholder="Ví dụ: Team UI Sprint"
                                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:bg-white dark:border-[#2f2f2f] dark:bg-[#171717] dark:text-white"
                            />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-200">
                            <span className="font-medium">Anh nhom</span>
                            <span className="flex h-[38px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 dark:border-[#2f2f2f] dark:bg-[#171717]">
                                {groupImagePreviewUrl ? (
                                    <img
                                        src={groupImagePreviewUrl}
                                        alt="Anh nhom"
                                        className="h-7 w-7 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-[#242424]">
                                        <ImagePlus size={15} />
                                    </span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm text-gray-600 dark:text-gray-300">
                                    {groupImageFile?.name || "Chon anh tu may"}
                                </span>
                                <span className="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-[#202020] dark:text-gray-200 dark:ring-[#333]">
                                    Chon anh
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        if (!file.type.startsWith("image/")) {
                                            setImageUploadError("Vui long chon file anh.");
                                            return;
                                        }
                                        setImageUploadError(null);
                                        setGroupImageFile(file);
                                        event.target.value = "";
                                    }}
                                />
                            </span>
                        </label>
                    </div>

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
                            placeholder="Tìm bạn bè để thêm vào nhóm"
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
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Dang tim nguoi dung theo so dien thoai...
                        </p>
                    )}
                    {phoneSearchResult && (
                        <button
                            type="button"
                            onClick={() => togglePhoneSearchResult(phoneSearchResult)}
                            className="flex w-full items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
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
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#2f2f2f] dark:bg-[#171717]">
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
                            <Users size={18} />
                            Không tìm thấy bạn bè phù hợp.
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
                                                toggleSelectedId(friend.id)
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
                                            alt={getFriendDisplayName(friend)}
                                            className="h-9 w-9 rounded-full object-cover"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                                {getFriendDisplayName(friend)}
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
                    {(error || imageUploadError) && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                            {error || imageUploadError}
                        </p>
                    )}

                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Đã chọn {selectedIds.length} người, {selectedInviteeIds.length} người nhận link
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-[#2f2f2f] dark:text-gray-200 dark:hover:bg-[#1b1b1b]"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSubmit()}
                                disabled={!canSubmit}
                                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                            >
                                {(submitting || imageUploading) && (
                                    <Loader2
                                        size={15}
                                        className="mr-2 animate-spin"
                                    />
                                )}
                                {imageUploading ? "Dang tai anh..." : "Tạo nhóm"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
