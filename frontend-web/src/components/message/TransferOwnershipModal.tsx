import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { ConversationMember } from "../../services/chatService";
import { DEFAULT_AVATAR_URL } from "../../constants/ui";

interface TransferOwnershipModalProps {
    open: boolean;
    members: ConversationMember[];
    submitting: boolean;
    pendingUserId: number | null;
    error: string | null;
    onClose: () => void;
    onSubmit: (newOwnerUserId: number) => Promise<boolean>;
}

function getDisplayName(member: ConversationMember): string {
    return member.nickname || member.username || `Người dùng ${member.userId}`;
}

export default function TransferOwnershipModal({
    open,
    members,
    submitting,
    pendingUserId,
    error,
    onClose,
    onSubmit,
}: TransferOwnershipModalProps) {
    const [searchKeyword, setSearchKeyword] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

    useEffect(() => {
        if (!open) {
            setSearchKeyword("");
            setSelectedUserId(null);
            return;
        }

        if (members.length > 0) {
            setSelectedUserId((previous) => previous ?? members[0].userId);
        }
    }, [members, open]);

    const filteredMembers = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return members;

        return members.filter((member) => {
            const searchable = [
                getDisplayName(member),
                member.username || "",
            ].join(" ");
            return searchable.toLowerCase().includes(keyword);
        });
    }, [members, searchKeyword]);

    const handleSubmit = async () => {
        if (!selectedUserId || submitting) return;
        await onSubmit(selectedUserId);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 py-6">
            <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-[#303030] dark:bg-[#111111]">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-[#2a2a2a]">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        Chọn trưởng nhóm mới trước khi rời
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-[#232323] dark:hover:text-gray-100"
                    >
                        <X size={18} />
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
                            placeholder="Tìm kiếm"
                            className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-400 dark:border-[#2f2f2f] dark:bg-[#171717] dark:text-white"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto border-y border-gray-200 px-5 py-3 dark:border-[#2a2a2a]">
                    {filteredMembers.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            Không tìm thấy thành viên phù hợp.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredMembers.map((member) => {
                                const checked =
                                    Number(selectedUserId) ===
                                    Number(member.userId);

                                return (
                                    <label
                                        key={member.userId}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                            checked
                                                ? "border-blue-200 bg-blue-50 dark:border-blue-700/60 dark:bg-blue-900/20"
                                                : "border-gray-200 hover:bg-gray-50 dark:border-[#2f2f2f] dark:hover:bg-[#1a1a1a]"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="transfer-owner"
                                            checked={checked}
                                            onChange={() =>
                                                setSelectedUserId(member.userId)
                                            }
                                            className="h-4 w-4"
                                        />
                                        <img
                                            src={
                                                member.avatar ||
                                                DEFAULT_AVATAR_URL
                                            }
                                            alt={getDisplayName(member)}
                                            className="h-10 w-10 rounded-full object-cover"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                                {getDisplayName(member)}
                                            </p>
                                            {member.username && (
                                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                    @{member.username}
                                                </p>
                                            )}
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

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#2a2a2a] dark:text-gray-200 dark:hover:bg-[#353535]"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSubmit()}
                            disabled={!selectedUserId || submitting}
                            className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                            {submitting && (
                                <Loader2
                                    size={15}
                                    className="mr-2 animate-spin"
                                />
                            )}
                            {pendingUserId
                                ? "Đang chuyển trưởng nhóm..."
                                : "Chọn và tiếp tục"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
