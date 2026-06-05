import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { type Message } from "../../services/chatService";
import { type MembersByUserId } from "../../stores/chatRuntimeStore";
import { DEFAULT_AVATAR_SMALL_URL } from "../../constants/ui";

interface ReactionDetailModalProps {
    open: boolean;
    onClose: () => void;
    reactions: Message["iconName"];
    membersById: MembersByUserId;
}

export default function ReactionDetailModal({
    open,
    onClose,
    reactions = [],
    membersById,
}: ReactionDetailModalProps) {
    const [activeTab, setActiveTab] = useState<string>("all");

    const tabs = useMemo(() => {
        const result = [{ id: "all", label: "Tất cả", count: 0 }];
        let total = 0;
        
        if (!reactions) return result;

        reactions.forEach(reaction => {
            const count = reaction.user.reduce((sum, u) => sum + u.quantity, 0);
            total += count;
            result.push({
                id: reaction.name,
                label: reaction.name,
                count: count
            });
        });
        
        result[0].count = total;
        return result;
    }, [reactions]);

    const usersToDisplay = useMemo(() => {
        if (!reactions) return [];

        if (activeTab === "all") {
            // Gom nhóm theo userId để biết 1 người thả những icon nào
            const userMap = new Map<number, { userId: number, emojis: string[], total: number }>();
            reactions.forEach(reaction => {
                reaction.user.forEach(u => {
                    const existing = userMap.get(u.userId) || { userId: u.userId, emojis: [], total: 0 };
                    if (!existing.emojis.includes(reaction.name)) {
                        existing.emojis.push(reaction.name);
                    }
                    existing.total += u.quantity;
                    userMap.set(u.userId, existing);
                });
            });
            return Array.from(userMap.values());
        } else {
            const reaction = reactions.find(r => r.name === activeTab);
            if (!reaction) return [];
            return reaction.user.map(u => ({
                userId: u.userId,
                emojis: [reaction.name],
                total: u.quantity
            }));
        }
    }, [activeTab, reactions]);

    if (!open) return null;

    return (
        <div 
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div 
                className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a1a1a] flex flex-col h-[520px] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Biểu cảm
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-44 border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 overflow-y-auto custom-scrollbar">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center justify-between px-5 py-4 text-sm transition-all ${
                                    activeTab === tab.id
                                        ? "bg-white dark:bg-gray-800 text-blue-600 font-bold shadow-sm"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/50"
                                }`}
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className="text-base leading-none">
                                        {tab.id === "all" ? "📊" : tab.label}
                                    </span>
                                    <span>{tab.id === "all" ? "Tất cả" : null}</span>
                                </span>
                                <span className="text-xs font-medium opacity-60 bg-gray-200/50 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* User List */}
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white dark:bg-[#1a1a1a]">
                        {usersToDisplay.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <p>Chưa có biểu cảm nào</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {usersToDisplay.map((u) => {
                                    const member = membersById[u.userId];
                                    return (
                                        <div key={u.userId} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img
                                                        src={member?.avatar || DEFAULT_AVATAR_SMALL_URL}
                                                        alt={member?.nickname}
                                                        className="h-11 w-11 rounded-full object-cover ring-2 ring-transparent group-hover:ring-blue-100 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-[15px] font-semibold text-gray-900 dark:text-white">
                                                        {member?.nickname || member?.username || `Người dùng ${u.userId}`}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        @{member?.username || "unknown"}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                                <div className="flex items-center -space-x-1">
                                                    {u.emojis.map((emoji, idx) => (
                                                        <span key={idx} className="text-base leading-none drop-shadow-sm">
                                                            {emoji}
                                                        </span>
                                                    ))}
                                                </div>
                                                {u.total > 1 && (
                                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 ml-1">
                                                        {u.total}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
