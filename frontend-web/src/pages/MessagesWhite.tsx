import { useState, useEffect } from "react";
import chatService, { type Conversation } from "../services/chatService";
import ChatWindow from "../components/message/ChatWindow";

export default function MessagesWhite() {
    const [searchQuery, setSearchQuery] = useState("");
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConversationId, setSelectedConversationId] = useState<
        number | null
    >(null);

    // Tạm thời lấy userId từ url (sau có phần đăng nhập sẽ lấy từ context của security)
    const query = new URLSearchParams(window.location.search);
    const currentUserId = parseInt(query.get("userId") || "1");

    useEffect(() => {
        loadConversations();
    }, []);

    const loadConversations = async () => {
        try {
            setLoading(true);
            const convs = await chatService.getConversations(currentUserId);
            if (convs.success && convs.data) {
                setConversations(convs.data);
            } else {
                setConversations([]);
                console.error(convs.message, convs.errors);
            }
        } catch (error) {
            console.error("Error loading conversations:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredConversations = searchQuery
        ? conversations.filter((conv) => {
              const displayName =
                  conv.type === "GROUP"
                      ? conv.name
                      : conv.members?.find((m) => m.userId !== currentUserId)
                            ?.nickname;
              return displayName
                  ?.toLowerCase()
                  .includes(searchQuery.toLowerCase());
          })
        : conversations;

    const getDisplayInfo = (conv: Conversation) => {
        if (conv.type === "GROUP") {
            return {
                name: conv.name || "Group Chat",
                avatar: conv.imageUrl || "https://i.pravatar.cc/150?img=20",
            };
        }
        const otherMember = conv.members?.find(
            (m) => m.userId !== currentUserId,
        );
        return {
            name: otherMember?.nickname || "Unknown",
            avatar: otherMember?.avatar || "https://i.pravatar.cc/150",
        };
    };

    return (
        <div className="py-6">
            <div className="bg-white border border-gray-200 rounded-lg h-[calc(100vh-120px)] flex">
                {/* Left Sidebar - Chat List */}
                <div className="hidden md:block w-96 border-r border-gray-200">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Messages</h2>
                        </div>

                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    <div className="overflow-y-auto h-[calc(100%-100px)]">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-gray-500">Đang tải...</p>
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
                                const isActive =
                                    selectedConversationId === conv.id;

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() =>
                                            setSelectedConversationId(conv.id)
                                        }
                                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                                            isActive
                                                ? "bg-gray-100"
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        <div className="relative">
                                            <img
                                                src={displayInfo.avatar}
                                                alt={displayInfo.name}
                                                className="w-14 h-14 rounded-full object-cover"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">
                                                {displayInfo.name}
                                            </p>
                                            <p className="text-sm text-gray-500 truncate">
                                                {conv.lastMessage
                                                    ?.lastMessageContent ||
                                                    "Bắt đầu trò chuyện"}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Side - Chat Window */}
                <div className="flex-1">
                    {selectedConversationId ? (
                        <ChatWindow
                            key={selectedConversationId}
                            conversationId={selectedConversationId}
                            userId={currentUserId}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <h3 className="text-xl font-light mb-2">
                                    Chọn một cuộc trò chuyện
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Chọn từ danh sách bên trái để bắt đầu chat
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
