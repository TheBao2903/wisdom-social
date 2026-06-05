import { Info, Phone, Video } from "lucide-react";
import { DEFAULT_GROUP_AVATAR_URL } from "../../constants/ui";
import ConversationAvatar from "./ConversationAvatar";

interface ChatHeaderProps {
    displayName: string;
    displayAvatar?: string | null;
    displayCompositeAvatars?: string[];
    conversationType?: "DIRECT" | "GROUP";
    defaultAvatarUrl: string;
    canCall: boolean;
    isConversationReadOnly: boolean;
    showInfoPanel: boolean;
    onStartCall: (callType: "audio" | "video") => void;
    onToggleInfoPanel?: () => void;
}

export default function ChatHeader({
    displayName,
    displayAvatar,
    displayCompositeAvatars = [],
    conversationType,
    defaultAvatarUrl,
    canCall,
    isConversationReadOnly,
    showInfoPanel,
    onStartCall,
    onToggleInfoPanel,
}: ChatHeaderProps) {
    const isGroup = conversationType === "GROUP";
    const actionsDisabled = !canCall || isConversationReadOnly;

    return (
        <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-gray-700 px-5 py-3.5 bg-white dark:bg-black backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <ConversationAvatar
                    name={displayName}
                    avatarUrl={displayAvatar}
                    compositeAvatarUrls={
                        isGroup ? displayCompositeAvatars : undefined
                    }
                    fallbackAvatarUrl={
                        isGroup ? DEFAULT_GROUP_AVATAR_URL : defaultAvatarUrl
                    }
                    sizeClassName="h-10 w-10"
                    ringClassName="ring-1 ring-gray-200 dark:ring-gray-700"
                />
                <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {displayName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Active now
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white disabled:opacity-40"
                    onClick={() => onStartCall("audio")}
                    disabled={actionsDisabled}
                    title="Gọi thoại"
                >
                    <Phone size={18} />
                </button>
                <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white disabled:opacity-40"
                    onClick={() => onStartCall("video")}
                    disabled={actionsDisabled}
                    title="Gọi video"
                >
                    <Video size={18} />
                </button>
                <button
                    type="button"
                    onClick={onToggleInfoPanel}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
                        showInfoPanel
                            ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    }`}
                    title={showInfoPanel ? "Ẩn thông tin" : "Hiện thông tin"}
                    disabled={actionsDisabled}
                >
                    <Info size={18} />
                </button>
            </div>
        </div>
    );
}
