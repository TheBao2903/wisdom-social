import { Link } from "react-router-dom";
import type { Chat } from "../../types";

interface ChatListProps {
    chats: Chat[];
}

export default function ChatList({ chats }: ChatListProps) {
    return (
        <div className="flex flex-col">
            {chats.map((chat) => (
                <Link
                    key={chat.id}
                    to={`/messages/${chat.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#262626]"
                >
                    <div className="relative">
                        <img
                            src={chat.user.avatarUrl}
                            alt={chat.user.username}
                            className="w-14 h-14 rounded-full"
                        />
                        {chat.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {chat.unreadCount}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                            {chat.user.username}
                        </p>
                        <p
                            className={`text-sm truncate ${chat.unreadCount > 0 ? "font-semibold text-black dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
                        >
                            {chat.lastMessage.text}
                        </p>
                    </div>
                    <div className="text-xs text-gray-400">
                        {chat.lastMessage.createdAt}
                    </div>
                </Link>
            ))}
        </div>
    );
}
