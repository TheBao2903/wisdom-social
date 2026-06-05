/**
 * Import các thư viện cần thiết:
 * - Client: STOMP client để quản lý kết nối WebSocket
 * - IMessage: Interface cho message từ STOMP
 * - SockJS: Thư viện fallback cho WebSocket (hỗ trợ các browser cũ)
 */
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { Conversation, JoinRequest, Message, MessageType, PollResponse } from "./chatService";
import { SOCKJS_URL } from "../config/backend";

const normalizePresencePhone = (phone?: string | null): string | null => {
    if (!phone) return null;
    const normalized = phone.trim().replace(/\s+/g, "");
    if (!normalized) return null;
    if (normalized.startsWith("+84")) return normalized;
    if (normalized.startsWith("0")) return `+84${normalized.substring(1)}`;
    if (normalized.startsWith("84")) return `+${normalized}`;
    return `+84${normalized}`;
};

export type CallStatus =
    | "calling"
    | "ringing"
    | "accepted"
    | "rejected"
    | "ended";

export type CallSignalEvent =
    | "call-user"
    | "incoming-call"
    | "answer-call"
    | "ice-candidate"
    | "reject-call"
    | "end-call"
    | "join-call"
    | "call-participants"
    | "request-active-call"
    | "check-active-call";

export interface CallSignalPayload {
    event: CallSignalEvent;
    conversationId: number;
    callId: string;
    callType: "audio" | "video";
    fromUserId: number;
    targetUserId: number;
    participantUserIds?: number[];
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit | Record<string, unknown>;
    timestamp?: string;
}

/**
 * Type định nghĩa các loại event từ backend
 * Tương ứng với DomainEventType enum trong backend
 */
export type DomainEventType =
    | "MESSAGE_CREATED" // Tin nhắn mới được tạo
    | "MESSAGE_RECALLED" // Tin nhắn bị thu hồi
    | "MESSAGE_SEEN" // Đánh dấu đã xem tin nhắn
    | "MESSAGE_REACTION" // Cập nhật reaction của tin nhắn
    | "TYPING" // User đang soạn tin nhắn
    | "ROOM_CREATED" // Phòng chat mới
    | "ROOM_UPDATED" // Phòng chat được cập nhật
    | "ROOM_DELETED" // Phòng chat bị xóa
    | "MEMBER_ADDED" // Thành viên mới tham gia
    | "MEMBER_ROLE_UPDATED"
    | "MEMBER_LEFT"
    | "MEMBER_KICKED"
    | "CONVERSATION_BLOCKED_MEMBERS_UPDATED"
    | "GROUP_DISBANDED"
    | "PIN_MESSAGE"
    | "UPIN_MESSAGE"
    | "MEMBER_UPDATED"
    | "MEMBER_ACCOUNT_LOCK_CHANGED"
    | "DIRECT_BLOCK_STATUS_CHANGED"
    | "NEW_JOIN_REQUEST"
    | "JOIN_REQUEST_PROCESSED";

export interface PinUpdatedEvent {
    domainEventType: "PIN_MESSAGE" | "UPIN_MESSAGE";
    conversationId: number;
    currentPins: Array<{
        messageId: string;
        pinnerId: number;
        pinnedAt: string;
        originalSenderId?: number;
        type?:
        | "TEXT"
        | "IMAGE"
        | "VIDEO"
        | "FILE"
        | "AUDIO"
        | "CALL"
        | "SYSTEM_PIN"
        | "SYSTEM_UPIN"
        | "SYSTEM_POLL_CREATED"
        | "SYSTEM_POLL_VOTED"
        | "SYSTEM_POLL_CHANGED"
        | "SYSTEM_POLL_CLOSED"
        | "SYSTEM_POLL_PINNED";
        content?: string;
    }>;
}

export interface MemberUpdatedEvent {
    domainEventType: "MEMBER_UPDATED";
    conversationId: number;
    userId: number;
    newNickname: string;
    newAvatar?: string;
}

/**
 * Sự kiện realtime khi tài khoản của 1 thành viên bị khóa/mở khóa.
 * Phát trên cùng topic /topic/conversations/{id}/members.
 * FE dùng để mask (hoặc bỏ mask) tên + avatar cho các user khác cùng hội thoại.
 */
export interface MemberAccountLockChangedEvent {
    domainEventType: "MEMBER_ACCOUNT_LOCK_CHANGED";
    conversationId: number;
    userId: number;
    accountLocked: boolean;
}

export interface DirectBlockStatusChangedEvent {
    domainEventType: "DIRECT_BLOCK_STATUS_CHANGED";
    conversationId: number;
    blockerId: number;
    blockedId: number;
    blocked: boolean;
}

/**
 * Interface cho MessageCreatedEvent từ backend
 *
 * CẤU TRÚC TỪ BACKEND:
 * - ChatEventListener gửi toàn bộ event qua WebSocket
 * - Topic: /topic/conversation/{conversationId}
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. User gửi tin nhắn trong conversation
 * 2. Backend lưu tin nhắn vào DB
 * 3. Publish MessageCreatedEvent
 * 4. ChatEventListener bắt event và gửi qua WebSocket
 * 5. Frontend nhận event này và hiển thị tin nhắn real-time
 */
export interface MessageCreatedEvent {
    domainEventType: "MESSAGE_CREATED";
    messageResponse: Message;
}

/**
 * Interface cho MessageRecalledEvent từ backend
 *
 * CẤU TRÚC TỪ BACKEND:
 * - ChatEventListener gửi toàn bộ event qua WebSocket
 * - Topic: /topic/conversation/{conversationId}
 * - Payload: { domainEventType: "MESSAGE_RECALLED", messageRecalledResponse: { messageId, conversationId } }
 */
export interface MessageRecalledEvent {
    domainEventType: "MESSAGE_RECALLED";
    messageRecalledResponse: {
        messageId: string;
        conversationId: number;
        createdAt: string;
    };
}

/**
 * Interface cho MessageSeenEvent từ backend
 *
 * CẤU TRÚC TỪ BACKEND:
 * - ChatEventListener gửi event qua WebSocket khi user đánh dấu đã đọc
 * - Topic: /topic/conversation/{conversationId} (BROADCAST cho TẤT CẢ members)
 * - Payload: { messageSeenResponse: { conversationId, userId, lastMessageId, seenAt }, domainEventType: "MESSAGE_SEEN" }
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. User A mở phòng chat và đọc tin nhắn
 * 2. FE gọi API PUT /conversations/{id}/read?lastMessageId=xxx
 * 3. Backend lưu mốc đã đọc và publish MessageSeenEvent
 * 4. ChatEventListener broadcast event qua /topic/conversation/{id}
 * 5. Frontend của TẤT CẢ members (kể cả User A) nhận event
 * 6. Frontend phải check userId để BỎ QUA event của chính mình
 * 7. Chỉ cập nhật avatar "Đã xem" cho event của người khác
 */
export interface MessageSeenEvent {
    domainEventType: "MESSAGE_SEEN";
    messageSeenResponse: {
        conversationId: number;
        userId: number;
        lastMessageId: string;
        seenAt: string;
    };
}

export interface MessageReactionEvent {
    domainEventType: "MESSAGE_REACTION";
    messageResponse: Message;
}

export interface PollUpdatedEvent {
    domainEventType: "POLL_UPDATED";
    poll: PollResponse;
}

/**
 * Interface cho TypingEvent từ backend
 *
 * CẤU TRÚC TỪ BACKEND:
 * - ChatEventListener broadcast typing status qua WebSocket
 * - Topic: /topic/conversation/{conversationId} (BROADCAST cho TẤT CẢ members)
 * - Payload: { domainEventType: "TYPING", typingResponse: { conversationId, userId, isTyping } }
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. User A bắt đầu gõ tin nhắn
 * 2. FE gửi signal qua WebSocket: /app/chat/{conversationId}/typing với { isTyping: true }
 * 3. Backend publish TypingEvent
 * 4. ChatEventListener broadcast tới tất cả members đang subscribe /topic/conversation/{id}
 * 5. FE của members khác nhận event và hiển thị "dummy message bubble"
 * 6. Khi User A ngừng gõ/gửi tin: FE gửi { isTyping: false }
 * 7. FE của members khác xóa "dummy message bubble"
 */
export interface TypingEvent {
    domainEventType: "TYPING";
    typingResponse: {
        conversationId: number;
        userId: number;
        isTyping: boolean;
    };
}

/**
 * Interface cho ConversationUpdatedEvent từ backend
 *
 * CẤU TRÚC TỪ BACKEND:
 * - ConversationEventListener gửi toàn bộ event qua WebSocket
 * - Topic: /topic/user/{userId}/conversations
 * - Gửi tới TẤT CẢ members trong conversation
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Có tin nhắn mới trong conversation
 * 2. Backend publish ConversationUpdatedEvent với memberIds
 * 3. ConversationEventListener gửi event tới topic của TỪNG member
 * 4. Frontend của tất cả members nhận event
 * 5. Cập nhật sidebar với lastMessage mới
 */
export interface ConversationUpdatedEvent {
    // Loại event từ backend
    domainEventType?: "ROOM_UPDATED";
    type?: "ROOM_UPDATED";

    // ID của conversation được cập nhật - nằm trong event, KHÔNG nằm trong lastMessage
    conversationId: number;

    // Thông tin tin nhắn cuối cùng - dùng để cập nhật sidebar
    // LƯU Ý: Backend không gửi conversationId trong lastMessage
    lastMessage: {
        lastMessageContent: string; // Nội dung tin nhắn
        lastMessageType: MessageType; // Loại tin nhắn
        lastSenderId: number; // ID người gửi
        lastSenderName: string; // Tên người gửi
        lastMessageAt: string; // Thời điểm gửi (ISO string)
        read: boolean; // Đã đọc hay chưa - luôn là false khi mới nhận từ WebSocket
    };
}

export interface ConversationCreatedEvent {
    domainEventType?: "ROOM_CREATED";
    type?: "ROOM_CREATED";
    conversationResponse?: Conversation;
}

export interface ConversationMembershipEvent {
    domainEventType?:
    | "MEMBER_ADDED"
    | "MEMBER_ROLE_UPDATED"
    | "MEMBER_LEFT"
    | "MEMBER_KICKED";
    conversationResponse?: Conversation;
}

export interface GroupDisbandedEvent {
    domainEventType?: "GROUP_DISBANDED";
    conversationId?: number;
    lastMessage?: LastMessageUpdate;
}

export interface NewJoinRequestEvent {
    domainEventType: "NEW_JOIN_REQUEST";
    conversationId: number;
    requestData: JoinRequest;
}

export interface JoinRequestProcessedEvent {
    domainEventType: "JOIN_REQUEST_PROCESSED";
    conversationId: number;
    requestId: number;
}

export interface BlockedMembersUpdatedEvent {
    domainEventType: "CONVERSATION_BLOCKED_MEMBERS_UPDATED";
    conversationId: number;
    targetUserId: number;
    blocked: boolean;
}

/**
 * Type alias cho dữ liệu cập nhật conversation
 * Để backward compatible với code hiện tại
 */
export type LastMessageUpdate = ConversationUpdatedEvent["lastMessage"];

export type ConversationSnapshot = Conversation & {
    processedJoinRequestId?: number;
};

function toFiniteNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function toLastMessageUpdate(
    conversation: Conversation,
): LastMessageUpdate | null {
    const lastMessage = conversation.lastMessage;
    if (!lastMessage) return null;

    return {
        lastMessageContent: lastMessage.lastMessageContent,
        lastMessageType: lastMessage.lastMessageType,
        lastSenderId: lastMessage.lastSenderId,
        lastSenderName: lastMessage.lastSenderName,
        lastMessageAt: lastMessage.lastMessageAt,
        read: lastMessage.read,
    };
}

function buildFallbackLastMessageUpdate(
    conversation: Conversation,
): LastMessageUpdate {
    return {
        lastMessageContent: "",
        lastMessageType: "SYSTEM_CREATE_GROUP",
        lastSenderId: 0,
        lastSenderName: "",
        lastMessageAt: conversation.updatedAt,
        read: false,
    };
}

function buildSystemFallbackByDomainEvent(
    domainEventType?: DomainEventType,
): LastMessageUpdate {
    const now = new Date().toISOString();

    if (domainEventType === "MEMBER_ADDED") {
        return {
            lastMessageContent: "",
            lastMessageType: "SYSTEM_ADD_MEMBER",
            lastSenderId: 0,
            lastSenderName: "",
            lastMessageAt: now,
            read: false,
        };
    }

    if (domainEventType === "MEMBER_ROLE_UPDATED") {
        return {
            lastMessageContent: "",
            lastMessageType: "SYSTEM_UPDATE_ROLE",
            lastSenderId: 0,
            lastSenderName: "",
            lastMessageAt: now,
            read: false,
        };
    }

    if (domainEventType === "MEMBER_KICKED") {
        return {
            lastMessageContent: "",
            lastMessageType: "SYSTEM_KICK_MEMBER",
            lastSenderId: 0,
            lastSenderName: "",
            lastMessageAt: now,
            read: false,
        };
    }

    if (domainEventType === "MEMBER_LEFT") {
        return {
            lastMessageContent: "",
            lastMessageType: "SYSTEM_LEAVE_GROUP",
            lastSenderId: 0,
            lastSenderName: "",
            lastMessageAt: now,
            read: false,
        };
    }

    return {
        lastMessageContent: "",
        lastMessageType: "SYSTEM_DISBAND_GROUP",
        lastSenderId: 0,
        lastSenderName: "",
        lastMessageAt: now,
        read: false,
    };
}
/**
 * WebSocketService - Singleton service quản lý kết nối WebSocket real-time
 *
 * Luồng hoạt động:
 * 1. Component gọi connect() để thiết lập kết nối
 * 2. Sau khi connected, gọi subscribeToConversation() để lắng nghe tin nhắn
 * 3. Khi có tin nhắn mới, callback được gọi để cập nhật UI
 * 4. Khi unmount, gọi unsubscribeFromConversation() để dọn dẹp
 */
class WebSocketService {
    /**
     * STOMP client - đối tượng quản lý kết nối WebSocket
     * null khi chưa khởi tạo hoặc đã disconnect
     */
    private client: Client | null = null;

    /**
     * Map lưu các subscription đang active
     * Key: destination (vd: "/topic/conversation/1")
     * Value: subscription object để unsubscribe sau này
     */
    private subscriptions: Map<string, any> = new Map();
    private subscriptionFactories: Map<
        string,
        () => { unsubscribe: () => void }
    > = new Map();
    private userConversationCallbacks: Map<
        number,
        Set<(
            conversationId: number,
            lastMessage: LastMessageUpdate,
            conversation?: ConversationSnapshot,
        ) => void>
    > = new Map();
    private profileUpdateListeners: Map<
        string,
        Set<(updatedUser: any) => void>
    > = new Map();
    private topicListeners: Map<
        string,
        Set<(message: any) => void>
    > = new Map();

    private callEventListeners: Map<
        number,
        Set<(event: CallSignalPayload) => void>
    > = new Map();
    private presenceLoginPhone: string | null = null;
    private presenceHeartbeatTimer: number | null = null;
    private presenceListeners: Map<
        number,
        Set<(event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void>
    > = new Map();
    private conversationSeenCallbacks: Map<
        number,
        Set<(event: MessageSeenEvent) => void>
    > = new Map();

    /**
     * Promise theo dõi trạng thái kết nối
     * - null: chưa kết nối hoặc đã kết nối xong
     * - Promise<void>: đang trong quá trình kết nối
     * Dùng để tránh nhiều component cùng gọi connect() tạo duplicate connections
     */
    private connectPromise: Promise<void> | null = null;

    setPresenceIdentity(phone?: string | null) {
        // Phone được gửi qua STOMP CONNECT header "login" để backend map session -> user.
        this.presenceLoginPhone = normalizePresencePhone(phone);
    }

    private getPresenceConnectHeaders(): Record<string, string> | undefined {
        return this.presenceLoginPhone ? { login: this.presenceLoginPhone } : undefined;
    }

    private startPresenceHeartbeat() {
        this.stopPresenceHeartbeat();
        if (!this.presenceLoginPhone) return;

        // Heartbeat presence chạy trên WebSocket đang mở, không tạo request REST định kỳ.
        this.presenceHeartbeatTimer = window.setInterval(() => {
            if (!this.client?.connected) return;
            this.client.publish({
                destination: "/app/presence/heartbeat",
                body: "{}",
            });
        }, 30000);
    }

    private stopPresenceHeartbeat() {
        if (this.presenceHeartbeatTimer) {
            window.clearInterval(this.presenceHeartbeatTimer);
            this.presenceHeartbeatTimer = null;
        }
    }

    private syncSubscriptions() {
        if (!this.client?.connected) return;

        this.subscriptionFactories.forEach((factory, destination) => {
            if (this.subscriptions.has(destination)) return;

            try {
                const subscription = factory();
                this.subscriptions.set(destination, subscription);
            } catch (error) {
                console.warn("Không thể đồng bộ lại WebSocket subscription:", {
                    destination,
                    error,
                });
            }
        });
    }

    private registerSubscription(
        destination: string,
        factory: () => { unsubscribe: () => void },
    ) {
        this.subscriptionFactories.set(destination, factory);

        const activeSubscription = this.subscriptions.get(destination);
        if (activeSubscription) {
            activeSubscription.unsubscribe();
            this.subscriptions.delete(destination);
        }

        this.syncSubscriptions();
    }

    private removeSubscription(destination: string) {
        const activeSubscription = this.subscriptions.get(destination);
        if (activeSubscription) {
            activeSubscription.unsubscribe();
            this.subscriptions.delete(destination);
        }

        this.subscriptionFactories.delete(destination);
    }

    /**
     * Thiết lập kết nối WebSocket tới server
     *
     * @param onConnect - Callback được gọi khi kết nối thành công
     * @param onError - Callback được gọi khi có lỗi
     * @returns Promise<void> - resolve khi kết nối thành công, reject khi lỗi
     *
     * Cách sử dụng:
     * await websocketService.connect();
     * websocketService.subscribeToConversation(1, handleMessage);
     */
    connect(
        onConnect?: () => void,
        onError?: (error: any) => void,
    ): Promise<void> {
        console.log("🔵 WebSocket connect() called");

        // BƯỚC 1: Kiểm tra nếu đang có quá trình kết nối
        // Trả về promise hiện tại để tránh tạo nhiều kết nối
        if (this.connectPromise) {
            console.log("🟠 Already connecting, returning existing promise");
            return this.connectPromise;
        }

        // BƯỚC 2: Kiểm tra nếu đã kết nối rồi
        // client.connected = true nghĩa là STOMP handshake đã hoàn tất
        if (this.client?.connected) {
            console.log("🟢 WebSocket already connected");
            onConnect?.();
            return Promise.resolve();
        }

        console.log("🟡 Starting new WebSocket connection...");

        // BƯỚC 3: Tạo Promise mới cho quá trình kết nối
        this.connectPromise = new Promise<void>((resolve, reject) => {
            // Khởi tạo STOMP Client với các cấu hình
            this.client = new Client({
                /**
                 * webSocketFactory: Hàm tạo WebSocket connection
                 * Sử dụng SockJS làm fallback cho các browser không hỗ trợ WebSocket
                 * Endpoint: /ws (proxy hoặc cùng origin)
                 */
                webSocketFactory: () => {
                    console.log(
                        "🟡 Creating SockJS connection to",
                        SOCKJS_URL,
                    );
                    return new SockJS(SOCKJS_URL);
                },

                /**
                 * debug: Hàm log để debug STOMP protocol
                 * Hiển thị các STOMP frame: CONNECT, CONNECTED, SUBSCRIBE, MESSAGE, etc.
                 */
                debug: (str) => {
                    console.log("🔷 STOMP: " + str);
                },

                /**
                 * reconnectDelay: Thời gian chờ trước khi reconnect (ms)
                 * Nếu mất kết nối, sẽ tự động thử kết nối lại sau 5 giây
                 */
                reconnectDelay: 5000,

                /**
                 * heartbeatIncoming: Thời gian chờ heartbeat từ server (ms)
                 * Client expect nhận heartbeat từ server mỗi 4 giây
                 * Nếu không nhận được -> coi như mất kết nối
                 */
                heartbeatIncoming: 4000,

                /**
                 * heartbeatOutgoing: Thời gian gửi heartbeat tới server (ms)
                 * Client gửi heartbeat cho server mỗi 4 giây
                 * Để server biết client còn sống
                 */
                heartbeatOutgoing: 4000,
                connectHeaders: this.getPresenceConnectHeaders(),

                /**
                 * onConnect: Callback khi STOMP connection thành công
                 * Được gọi sau khi nhận được CONNECTED frame từ server
                 * Lúc này có thể bắt đầu subscribe các topic
                 */
                onConnect: () => {
                    console.log("🟢🟢🟢 STOMP Connected to server 🟢🟢🟢");
                    this.connectPromise = null; // Reset promise
                    this.startPresenceHeartbeat();
                    this.syncSubscriptions();
                    window.dispatchEvent(new Event("wisdom-websocket-reconnected"));
                    onConnect?.(); // Gọi callback của caller
                    resolve(); // Resolve promise để caller biết đã kết nối xong
                },

                /**
                 * onStompError: Callback khi có lỗi STOMP protocol
                 * VD: subscribe topic không tồn tại, authentication failed, etc.
                 */
                onStompError: (frame) => {
                    console.error(
                        "🔴 Broker reported error: " + frame.headers["message"],
                    );
                    console.error("🔴 Additional details: " + frame.body);
                    this.connectPromise = null; // Reset promise
                    onError?.(frame);
                    reject(frame); // Reject promise để caller xử lý lỗi
                },

                /**
                 * onWebSocketError: Callback khi có lỗi WebSocket transport
                 * VD: network error, connection refused, timeout, etc.
                 */
                onWebSocketError: (error) => {
                    console.error("🔴 WebSocket error:", error);
                    this.connectPromise = null; // Reset promise
                    onError?.(error);
                    reject(error); // Reject promise
                },
                onWebSocketClose: () => {
                    this.stopPresenceHeartbeat();
                    this.connectPromise = null;
                    this.subscriptions.clear();
                },
            });

            /**
             * activate(): Bắt đầu kết nối WebSocket
             * Các bước:
             * 1. Tạo WebSocket connection qua SockJS
             * 2. Gửi CONNECT frame
             * 3. Đợi CONNECTED frame từ server
             * 4. Gọi onConnect callback
             */
            console.log("🟡 Calling client.activate()");
            this.client.activate();
        });

        return this.connectPromise;
    }

    /**
     * Ngắt kết nối WebSocket và dọn dẹp tất cả subscriptions
     *
     * Các bước:
     * 1. Unsubscribe tất cả các topic đang lắng nghe
     * 2. Deactivate STOMP client (gửi DISCONNECT frame)
     * 3. Đóng WebSocket connection
     * 4. Reset client về null
     */
    disconnect() {
        this.stopPresenceHeartbeat();
        if (this.client) {
            // Unsubscribe tất cả subscriptions trước khi disconnect
            this.subscriptions.forEach((subscription) => {
                subscription.unsubscribe();
            });
            this.subscriptions.clear();
            this.subscriptionFactories.clear();
            this.profileUpdateListeners.clear();
            this.presenceListeners.clear();

            // Deactivate client (gửi DISCONNECT, đóng WebSocket)
            this.client.deactivate();
            this.client = null;
            // console.log("Disconnected from WebSocket");
        }
    }

    /**
     * Subscribe một conversation để nhận tin nhắn real-time
     *
     * @param conversationId - ID của conversation cần lắng nghe
     * @param callback - Hàm được gọi khi nhận tin nhắn mới
     * @param onRecall - Hàm được gọi khi tin nhắn bị thu hồi
     * @param onMessageSeen - Hàm được gọi khi có người đánh dấu đã xem
     *
     * LUỒNG HOẠT ĐỘNG:
     * 1. User A và User B đang mở conversation 123
     * 2. User A gửi tin nhắn "Hello"
     * 3. Backend lưu message và publish MessageCreatedEvent
     * 4. ChatEventListener bắt event và gửi qua WebSocket:
     *    - Topic: /topic/conversation/123
     *    - Data: { domainEventType: "MESSAGE_CREATED", messageResponse: {...} }
     * 5. Frontend của User A và B đang subscribe topic này
     * 6. Callback được gọi với message object
     * 7. Component thêm message vào danh sách và hiển thị
     *
     * CẤU TRÚC DỪ LIỆU NHẬN TỪ BACKEND:
     * {
     *   "domainEventType": "MESSAGE_CREATED" | "MESSAGE_RECALLED" | "MESSAGE_SEEN",
     *   "messageResponse": {...} // chỉ có khi MESSAGE_CREATED
     *   "messageRecalledResponse": {...} // chỉ có khi MESSAGE_RECALLED
     *   "messageSeenResponse": {...} // chỉ có khi MESSAGE_SEEN
     * }
     *
     * LƯU Ý: Phải gọi sau khi connect() đã hoàn tất
     */
    subscribeToConversation(
        conversationId: number,
        callback: (message: Message) => void,
        onRecall?: (messageId: string) => void,
        onMessageSeen?: (event: MessageSeenEvent) => void,
        onTyping?: (event: TypingEvent) => void,
        onReaction?: (message: Message) => void,
        onPollUpdated?: (poll: PollResponse) => void,
    ) {
        // BƯỚC 1: Kiểm tra client đã kết nối chưa
        // client.connected = true chỉ khi STOMP handshake hoàn tất
        // BƯỚC 2: Tạo destination theo format của backend: /topic/conversation/{id}
        const destination = `/topic/conversation/${conversationId}`;

        // BƯỚC 3: Kiểm tra đã subscribe destination này chưa để tránh duplicate
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) {
            existingSubscription.unsubscribe();
            this.subscriptions.delete(destination);
        }

        /**
         * BƯỚC 4: Subscribe topic và lưu subscription object
         *
         * client.subscribe() trả về subscription object với method:
         * - unsubscribe(): Dừng lắng nghe topic này
         *
         * Khi có MESSAGE frame từ server:
         * 1. Nhận raw message với body là JSON string
         * 2. Parse JSON thành event object (MessageCreatedEvent | MessageRecalledEvent | MessageSeenEvent)
         * 3. Phân loại dựa vào domainEventType
         * 4. Gọi callback tương ứng
         */
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    const event = JSON.parse(message.body) as
                        | MessageCreatedEvent
                        | MessageRecalledEvent
                        | MessageSeenEvent
                        | TypingEvent
                        | MessageReactionEvent
                        | PollUpdatedEvent;

                    console.log("Received conversation event:", event);

                    // Phân loại event dựa vào domainEventType (BE field)
                    if (event.domainEventType === "MESSAGE_RECALLED") {
                        const { messageId } = (event as MessageRecalledEvent)
                            .messageRecalledResponse;
                        onRecall?.(messageId);
                    } else if (event.domainEventType === "MESSAGE_SEEN") {
                        // MESSAGE_SEEN event - gọi callback onMessageSeen
                        onMessageSeen?.(event as MessageSeenEvent);
                    } else if (event.domainEventType === "TYPING") {
                        // TYPING event - gọi callback onTyping
                        onTyping?.(event as TypingEvent);
                    } else if (event.domainEventType === "MESSAGE_CREATED") {
                        const payload = (event as MessageCreatedEvent)
                            .messageResponse;
                        if (payload) callback(payload);
                    } else if (event.domainEventType === "MESSAGE_REACTION") {
                        const payload = (event as MessageReactionEvent)
                            .messageResponse;
                        if (payload) onReaction?.(payload);
                    } else if (event.domainEventType === "POLL_UPDATED") {
                        const payload = (event as PollUpdatedEvent).poll;
                        if (payload) onPollUpdated?.(payload);
                    }
                } catch (error) {
                    console.error("Error parsing message:", error);
                }
            },
            );
        });

        // BƯỚC 5: Lưu subscription vào Map để có thể unsubscribe sau
        // console.log(`Subscribed to ${destination}`);
    }

    /**
     * Unsubscribe khỏi một conversation
     *
     * @param conversationId - ID của conversation cần dừng lắng nghe
     *
     * Các bước:
     * 1. Lấy subscription object từ Map
     * 2. Gọi unsubscribe() để gửi UNSUBSCRIBE frame
     * 3. Xóa khỏi Map
     *
     * Thường gọi trong useEffect cleanup khi component unmount
     */
    unsubscribeFromConversation(conversationId: number) {
        const destination = `/topic/conversation/${conversationId}`;
        this.subscriptionFactories.delete(destination);
        const subscription = this.subscriptions.get(destination);

        if (subscription) {
            // Gửi UNSUBSCRIBE frame tới server
            subscription.unsubscribe();

            // Xóa khỏi Map
            this.subscriptions.delete(destination);
            // console.log(`Unsubscribed from ${destination}`);
        }
    }

    subscribeToConversationSeen(
        conversationId: number,
        onMessageSeen: (event: MessageSeenEvent) => void,
    ) {
        const callbacks =
            this.conversationSeenCallbacks.get(conversationId) ?? new Set();
        callbacks.add(onMessageSeen);
        this.conversationSeenCallbacks.set(conversationId, callbacks);

        if (!this.client?.connected) {
            console.error("WebSocket not connected, cannot subscribe to seen sync");
            return;
        }

        const destination = `/topic/conversation/${conversationId}`;
        const key = `${destination}::seen-sync`;
        if (this.subscriptions.has(key)) return;

        const subscription = this.client.subscribe(destination, (message: IMessage) => {
            try {
                const event = JSON.parse(message.body) as MessageSeenEvent;
                if (event.domainEventType === "MESSAGE_SEEN") {
                    this.conversationSeenCallbacks
                        .get(conversationId)
                        ?.forEach((callback) => callback(event));
                }
            } catch {
                // no-op: this lightweight listener only cares about MESSAGE_SEEN.
            }
        });

        this.subscriptions.set(key, subscription);
    }

    unsubscribeFromConversationSeen(
        conversationId: number,
        onMessageSeen?: (event: MessageSeenEvent) => void,
    ) {
        const key = `/topic/conversation/${conversationId}::seen-sync`;
        const callbacks = this.conversationSeenCallbacks.get(conversationId);
        if (callbacks && onMessageSeen) {
            callbacks.delete(onMessageSeen);
            if (callbacks.size > 0) return;
        }

        this.conversationSeenCallbacks.delete(conversationId);
        this.removeSubscription(key);
    }

    subscribeToConversationPins(
        conversationId: number,
        onPinUpdated: (event: PinUpdatedEvent) => void,
    ) {
        if (!this.client?.connected) {
            console.error("WebSocket not connected, cannot subscribe to pins");
            return;
        }

        const destination = `/topic/conversations/${conversationId}/pins`;
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) return;

        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    const event = JSON.parse(message.body) as PinUpdatedEvent;
                    onPinUpdated(event);
                } catch (error) {
                    console.error("Error parsing pin update:", error);
                }
            },
            );
        });

    }

    unsubscribeFromConversationPins(conversationId: number) {
        const destination = `/topic/conversations/${conversationId}/pins`;
        const subscription = this.subscriptions.get(destination);

        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
        }
    }

    subscribeToConversationMembers(
        conversationId: number,
        onMemberUpdated: (event: MemberUpdatedEvent) => void,
        onAccountLockChanged?: (event: MemberAccountLockChangedEvent) => void,
        onDirectBlockStatusChanged?: (event: DirectBlockStatusChangedEvent) => void,
    ) {
        if (!this.client?.connected) {
            console.error(
                "WebSocket not connected, cannot subscribe to member updates",
            );
            return;
        }

        const destination = `/topic/conversations/${conversationId}/members`;
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) return;

        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    const event = JSON.parse(message.body) as
                        | MemberUpdatedEvent
                        | MemberAccountLockChangedEvent
                        | DirectBlockStatusChangedEvent;
                    // Phân loại theo domainEventType. Mặc định (client cũ/không có
                    // field) coi như MEMBER_UPDATED để giữ tương thích ngược.
                    if (
                        event.domainEventType === "MEMBER_ACCOUNT_LOCK_CHANGED"
                    ) {
                        onAccountLockChanged?.(
                            event as MemberAccountLockChangedEvent,
                        );
                    } else if (
                        event.domainEventType === "DIRECT_BLOCK_STATUS_CHANGED"
                    ) {
                        onDirectBlockStatusChanged?.(
                            event as DirectBlockStatusChangedEvent,
                        );
                    } else {
                        onMemberUpdated(event as MemberUpdatedEvent);
                    }
                } catch (error) {
                    console.error("Error parsing member update:", error);
                }
            },
            );
        });
    }

    unsubscribeFromConversationMembers(conversationId: number) {
        const destination = `/topic/conversations/${conversationId}/members`;
        const subscription = this.subscriptions.get(destination);

        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
        }
    }

    /**
     * Subscribe để nhận cập nhật danh sách conversation (sidebar) real-time
     *
     * @param userId - ID của user hiện tại đang đăng nhập
     * @param callback - Hàm callback được gọi khi nhận được update từ WebSocket
     *
     * LUỒNG HOẠT ĐỘNG:
     * 1. User A gửi tin nhắn trong conversation có members [A, B, C]
     * 2. Backend publish ConversationUpdatedEvent với memberIds = [A, B, C]
     * 3. ConversationEventListener gửi LastMessageResponse qua WebSocket:
     *    - Topic: /topic/user/A/conversations
     *    - Topic: /topic/user/B/conversations
     *    - Topic: /topic/user/C/conversations
     * 4. Frontend của A, B, C đều nhận được update cùng lúc
     * 5. Callback được gọi với:
     *    - conversationId: ID conversation vừa có tin nhắn mới (từ event.conversationId)
     *    - lastMessage: Thông tin tin nhắn (từ event.lastMessage, KHÔNG chứa conversationId)
     * 6. Component cập nhật state và re-render sidebar
     *
     * KẾT QUẢ: Tất cả members thấy conversation được cập nhật và di chuyển lên đầu danh sách
     */
    subscribeToUserConversations(
        userId: number,
        callback: (
            conversationId: number,
            lastMessage: LastMessageUpdate,
            conversation?: ConversationSnapshot,
        ) => void,
    ) {
        // BƯỚC 1: Kiểm tra kết nối WebSocket
        // Phải đảm bảo STOMP handshake đã hoàn tất trước khi subscribe
        // BƯỚC 2: Tạo destination theo format của backend
        // Format: /topic/user/{userId}/conversations
        // VD: /topic/user/1/conversations cho user có ID = 1
        const destination = `/topic/user/${userId}/conversations`;
        const callbacks =
            this.userConversationCallbacks.get(userId) ?? new Set();
        callbacks.add(callback);
        this.userConversationCallbacks.set(userId, callbacks);
        const notifyCallbacks = (
            conversationId: number,
            lastMessage: LastMessageUpdate,
            conversation?: ConversationSnapshot,
        ) => {
            const listeners = Array.from(
                this.userConversationCallbacks.get(userId) ?? [],
            );
            listeners.forEach((listener) =>
                listener(conversationId, lastMessage, conversation),
            );
        };

        // BƯỚC 3: Kiểm tra đã subscribe destination này chưa
        // Tránh tạo duplicate subscription cho cùng một destination
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) {
            // console.log(`Already subscribed to ${destination}`);
            return;
        }

        // BƯỚC 4: Gửi SUBSCRIBE frame tới STOMP broker
        //
        // Khi có message mới từ backend:
        // 1. Nhận MESSAGE frame với body là JSON string
        // 2. Parse JSON thành ConversationUpdatedEvent object
        // 3. Event có cấu trúc: { type: "ROOM_UPDATED", conversationId: X, lastMessage: {...} }
        // 4. Trích xuất conversationId (từ event) và lastMessage (payload) riêng biệt
        // 5. Gọi callback với 2 tham số: conversationId và lastMessage
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    const payload = JSON.parse(message.body) as
                        | ConversationUpdatedEvent
                        | ConversationCreatedEvent
                        | ConversationMembershipEvent
                        | GroupDisbandedEvent
                        | NewJoinRequestEvent
                        | JoinRequestProcessedEvent
                        | BlockedMembersUpdatedEvent
                        | MemberAccountLockChangedEvent
                        | DirectBlockStatusChangedEvent;

                    // Khóa/mở khóa tài khoản của 1 thành viên -> cập nhật SIDEBAR
                    // (mask/bỏ mask tên + avatar) qua window event, không cần F5.
                    const lockPayload = payload as MemberAccountLockChangedEvent;
                    if (
                        lockPayload.domainEventType ===
                            "MEMBER_ACCOUNT_LOCK_CHANGED" &&
                        typeof lockPayload.conversationId === "number"
                    ) {
                        window.dispatchEvent(
                            new CustomEvent(
                                "conversation-member-lock-changed",
                                { detail: lockPayload },
                            ),
                        );
                        return;
                    }

                    const directBlockPayload =
                        payload as DirectBlockStatusChangedEvent;
                    if (
                        directBlockPayload.domainEventType ===
                            "DIRECT_BLOCK_STATUS_CHANGED" &&
                        typeof directBlockPayload.conversationId === "number"
                    ) {
                        window.dispatchEvent(
                            new CustomEvent(
                                "conversation-direct-block-status-changed",
                                { detail: directBlockPayload },
                            ),
                        );
                        return;
                    }

                    const createdConversation = (
                        payload as {
                            conversationResponse?: Conversation;
                        }
                    ).conversationResponse;
                    if (createdConversation?.id) {
                        const lastMessageData =
                            toLastMessageUpdate(createdConversation);
                        const resolvedLastMessage =
                            lastMessageData ??
                            buildFallbackLastMessageUpdate(createdConversation);
                        const conversationSnapshot: ConversationSnapshot = {
                            ...createdConversation,
                            lastMessage:
                                createdConversation.lastMessage ??
                                resolvedLastMessage,
                        };

                        notifyCallbacks(
                            createdConversation.id,
                            resolvedLastMessage,
                            conversationSnapshot,
                        );
                        return;
                    }

                    const disbandPayload = payload as GroupDisbandedEvent;
                    if (
                        disbandPayload.domainEventType === "GROUP_DISBANDED" &&
                        typeof disbandPayload.conversationId === "number"
                    ) {
                        notifyCallbacks(
                            disbandPayload.conversationId,
                            disbandPayload.lastMessage ??
                                buildSystemFallbackByDomainEvent(
                                    disbandPayload.domainEventType,
                                ),
                        );
                        return;
                    }

                    const joinRequestPayload = payload as NewJoinRequestEvent;
                    if (
                        joinRequestPayload.domainEventType === "NEW_JOIN_REQUEST" &&
                        typeof joinRequestPayload.conversationId === "number" &&
                        joinRequestPayload.requestData
                    ) {
                        const request = joinRequestPayload.requestData;
                        const requestSnapshotContent =
                            request.content ||
                            JSON.stringify([
                                {
                                    id: request.userId,
                                    name: request.userName,
                                },
                            ]);
                        notifyCallbacks(
                            joinRequestPayload.conversationId,
                            {
                                lastMessageContent:
                                    requestSnapshotContent,
                                lastMessageType: "SYSTEM_REQUIRE_APPROVAL",
                                lastSenderId: request.inviterId ?? 0,
                                lastSenderName: request.inviterName ?? "",
                                lastMessageAt:
                                    request.createdAt ||
                                    new Date().toISOString(),
                                read: false,
                            },
                            {
                                id: joinRequestPayload.conversationId,
                                type: "GROUP",
                                updatedAt:
                                    request.createdAt ||
                                    new Date().toISOString(),
                                pendingRequests: [request],
                            } as ConversationSnapshot,
                        );
                        return;
                    }

                    const processedJoinRequestPayload =
                        payload as JoinRequestProcessedEvent;
                    const processedJoinConversationId = toFiniteNumber(
                        processedJoinRequestPayload.conversationId,
                    );
                    const processedJoinRequestId = toFiniteNumber(
                        processedJoinRequestPayload.requestId,
                    );
                    if (
                        processedJoinRequestPayload.domainEventType ===
                            "JOIN_REQUEST_PROCESSED" &&
                        processedJoinConversationId !== null &&
                        processedJoinRequestId !== null
                    ) {
                        const now = new Date().toISOString();
                        notifyCallbacks(
                            processedJoinConversationId,
                            {
                                lastMessageContent: "",
                                lastMessageType: "SYSTEM_REQUIRE_APPROVAL",
                                lastSenderId: 0,
                                lastSenderName: "",
                                lastMessageAt: now,
                                read: true,
                            },
                            {
                                id: processedJoinConversationId,
                                type: "GROUP",
                                updatedAt: now,
                                processedJoinRequestId:
                                    processedJoinRequestId,
                            } as ConversationSnapshot,
                        );
                        return;
                    }

                    const blockedMembersPayload =
                        payload as BlockedMembersUpdatedEvent;
                    if (
                        blockedMembersPayload.domainEventType ===
                            "CONVERSATION_BLOCKED_MEMBERS_UPDATED" &&
                        typeof blockedMembersPayload.conversationId === "number"
                    ) {
                        window.dispatchEvent(
                            new CustomEvent("conversation-blocked-members-updated", {
                                detail: blockedMembersPayload,
                            }),
                        );
                        return;
                    }

                    const updatedEvent = payload as ConversationUpdatedEvent;
                    if (
                        typeof updatedEvent.conversationId === "number" &&
                        updatedEvent.lastMessage
                    ) {
                        notifyCallbacks(
                            updatedEvent.conversationId,
                            updatedEvent.lastMessage,
                        );
                    }
                } catch (error) {
                    console.error("Error parsing conversation update:", error);
                }
            },
            );
        });

        // BƯỚC 5: Lưu subscription vào Map để có thể unsubscribe sau này
        // console.log(`Subscribed to ${destination}`);
    }

    /**
     * Hủy subscription khỏi conversation updates của user
     *
     * @param userId - ID của user cần dừng lắng nghe
     *
     * ĐƯỢC GỌI KHI:
     * - Component Messages unmount (user rời khỏi trang messages)
     * - User logout
     * - Cần cleanup để tránh memory leak
     *
     * CÁC BƯỚC:
     * 1. Lấy destination đã subscribe: /topic/user/{userId}/conversations
     * 2. Tìm subscription object trong Map
     * 3. Gửi UNSUBSCRIBE frame tới server qua subscription.unsubscribe()
     * 4. Xóa subscription khỏi Map
     * 5. Server ngừng gửi message tới client cho destination này
     */
    unsubscribeFromUserConversations(
        userId: number,
        callback?: (
            conversationId: number,
            lastMessage: LastMessageUpdate,
            conversation?: ConversationSnapshot,
        ) => void,
    ) {
        if (callback) {
            const callbacks = this.userConversationCallbacks.get(userId);
            callbacks?.delete(callback);
            if (callbacks && callbacks.size > 0) {
                return;
            }
            this.userConversationCallbacks.delete(userId);
        } else {
            this.userConversationCallbacks.delete(userId);
        }
        // Tạo lại destination để tìm subscription
        const destination = `/topic/user/${userId}/conversations`;
        this.subscriptionFactories.delete(destination);
        const subscription = this.subscriptions.get(destination);

        if (subscription) {
            // Gửi UNSUBSCRIBE frame tới server
            subscription.unsubscribe();

            // Xóa khỏi Map để giải phóng bộ nhớ
            this.subscriptions.delete(destination);
            console.log(`Unsubscribed from ${destination}`);
        }
    }

    subscribeToPresence(
        currentUserId: number,
        callback: (event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void,
    ) {
        const listeners =
            this.presenceListeners.get(currentUserId) ??
            new Set<(event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void>();
        listeners.add(callback);
        this.presenceListeners.set(currentUserId, listeners);

        if (!this.client?.connected) {
            console.error("WebSocket not connected, cannot subscribe to presence");
            return;
        }

        const destination = `/topic/user/${currentUserId}/presence`;
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) return;

        const subscription = this.client.subscribe(destination, (message: IMessage) => {
            try {
                const raw = JSON.parse(message.body);
                const payload = raw?.payload ?? raw?.data ?? raw;
                const userId = Number(payload?.userId);
                if (!Number.isFinite(userId)) return;

                // Event realtime chi cap nhat cache UI; snapshot ban dau van lay bang REST.
                const event = {
                    userId,
                    online: Boolean(payload?.online ?? payload?.isOnline),
                    lastActiveAt: payload?.lastActiveAt ?? null,
                };
                this.presenceListeners
                    .get(currentUserId)
                    ?.forEach((listener) => listener(event));
            } catch (error) {
                console.error("Error parsing presence event:", error);
            }
        });

        this.subscriptions.set(destination, subscription);
    }

    unsubscribeFromPresence(
        currentUserId: number,
        callback?: (event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void,
    ) {
        const listeners = this.presenceListeners.get(currentUserId);

        if (callback && listeners) {
            listeners.delete(callback);
            if (listeners.size > 0) return;
        }

        if (!callback || !listeners || listeners.size === 0) {
            this.presenceListeners.delete(currentUserId);
        }

        const destination = `/topic/user/${currentUserId}/presence`;
        const subscription = this.subscriptions.get(destination);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
        }
    }

    subscribeToCallEvents(
        userId: number,
        callback: (event: CallSignalPayload) => void,
    ) {
        if (!this.client?.connected) {
            console.error(
                "WebSocket not connected, cannot subscribe to call events",
            );
            return;
        }

        const existingListeners = this.callEventListeners.get(userId);
        if (existingListeners) {
            existingListeners.add(callback);
        } else {
            this.callEventListeners.set(userId, new Set([callback]));
        }

        const destination = `/topic/user/${userId}/calls`;
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) return;

        const subscription = this.client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    const payload: CallSignalPayload = JSON.parse(message.body);
                    const listeners = this.callEventListeners.get(userId);
                    listeners?.forEach((listener) => listener(payload));
                } catch (error) {
                    console.error("Error parsing call signal event:", error);
                }
            },
        );

        this.subscriptions.set(destination, subscription);
    }

    unsubscribeFromCallEvents(
        userId: number,
        callback?: (event: CallSignalPayload) => void,
    ) {
        const listeners = this.callEventListeners.get(userId);

        if (callback && listeners) {
            listeners.delete(callback);
            if (listeners.size > 0) return;
        }

        if (!callback) {
            this.callEventListeners.delete(userId);
        } else if (!listeners || listeners.size === 0) {
            this.callEventListeners.delete(userId);
        }

        const destination = `/topic/user/${userId}/calls`;
        const subscription = this.subscriptions.get(destination);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
        }
    }

    sendCallSignal(payload: CallSignalPayload) {
        if (!this.client?.connected) {
            console.error("WebSocket not connected, cannot send call signal");
            return;
        }

        this.client.publish({
            destination: "/app/call.signal",
            body: JSON.stringify(payload),
        });
    }

    /**
     * Gửi typing signal tới backend
     *
     * @param conversationId - ID của conversation đang gõ tin nhắn
     * @param userId - ID của user đang gõ
     * @param isTyping - true nếu đang gõ, false nếu ngừng gõ
     *
     * CÁCH SỬ DỤNG:
     * - Gửi isTyping=true khi user gõ phím đầu tiên
     * - Gửi isTyping=false khi:
     *   + User nhấn Enter (gửi tin nhắn)
     *   + Input rỗng
     *   + Input mất focus
     *   + User ngừng gõ quá 10 giây
     *
     * Backend endpoint: /app/chat/{conversationId}/typing
     */
    sendTypingSignal(
        conversationId: number,
        userId: number,
        isTyping: boolean,
    ) {
        if (!this.client?.connected) {
            console.error("WebSocket not connected, cannot send typing signal");
            return;
        }

        console.log("Sending typing signal:", {
            conversationId,
            userId,
            isTyping,
        });

        this.client.publish({
            destination: `/app/chat/${conversationId}/typing`,
            body: JSON.stringify({ userId, isTyping }),
        });
    }

    /**
     * ============================================================================
     * DEPRECATED: subscribeToMessageSeen và unsubscribeFromMessageSeen
     * ============================================================================
     *
     * Các method này không còn được sử dụng vì backend đã thay đổi cách broadcast
     * MESSAGE_SEEN event:
     * - Trước: Gửi tới /user/queue/messages/seen (point-to-point)
     * - Giờ: Gửi tới /topic/conversation/{id} (broadcast cho toàn bộ conversation)
     *
     * MESSAGE_SEEN event giờ được xử lý trong subscribeToConversation() thông qua
     * callback onMessageSeen.
     */

    /**
     * Kiểm tra trạng thái kết nối hiện tại
     *
     * @returns true nếu WebSocket đã kết nối và STOMP handshake hoàn tất
     *
     * client.connected vs client.active:
     * - active: true khi đang cố kết nối hoặc đã kết nối
     * - connected: true chỉ khi STOMP handshake hoàn tất
     */
    isConnected(): boolean {
        return this.client?.connected || false;
    }

    /**
     * Subscribe một topic generic để nhận events real-time
     * Dùng cho các event như friend notifications, system notifications, etc.
     *
     * @param destination - Topic destination (e.g., /topic/user/{phone}/friend-request)
     * @param callback - Hàm được gọi khi nhận message
     */
    subscribeToTopic(destination: string, callback: (message: any) => void) {
        const listeners =
            this.topicListeners.get(destination) ?? new Set<(message: any) => void>();
        listeners.add(callback);
        this.topicListeners.set(destination, listeners);

        if (!this.client?.connected) {
            console.error(
                "WebSocket not connected, cannot subscribe to topic:",
                destination,
            );
            return;
        }

        // Check if already subscribed
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) {
            console.log(`Already subscribed to ${destination}`);
            return;
        }

        this.registerSubscription(destination, () =>
            this.client!.subscribe(destination, (message: IMessage) => {
                try {
                    // Try to parse as JSON, fallback to raw string
                    let parsedMessage;
                    try {
                        parsedMessage = JSON.parse(message.body);
                    } catch {
                        parsedMessage = message.body;
                    }
                    this.topicListeners
                        .get(destination)
                        ?.forEach((listener) => listener(parsedMessage));
                } catch (error) {
                    console.error(
                        `Error handling message from ${destination}:`,
                        error,
                    );
                }
            }),
        );
        console.log(`Subscribed to ${destination}`);
    }

    /**
     * Unsubscribe from a generic topic
     *
     * @param destination - Topic destination to unsubscribe from
     */
    unsubscribeFromTopic(destination: string, callback?: (message: any) => void) {
        if (callback) {
            const listeners = this.topicListeners.get(destination);
            listeners?.delete(callback);
            if (listeners && listeners.size > 0) {
                return;
            }
        }

        this.topicListeners.delete(destination);
        this.removeSubscription(destination);
        console.log(`Unsubscribed from ${destination}`);
    }

    /**
     * Subscribe to user profile updates
     * Notified when the user's profile is updated (name, avatar, bio, etc.)
     *
     * @param phone - User's phone number (international format)
     * @param callback - Function called when profile is updated with the new user data
     */
    subscribeToProfileUpdates(
        phone: string,
        callback: (updatedUser: any) => void,
    ) {
        console.log("🔵 subscribeToProfileUpdates called with phone:", phone);
        console.log("🔵 WebSocket client connected?", this.client?.connected);

        const destination = `/topic/user/${phone}/profile-update`;
        const listeners =
            this.profileUpdateListeners.get(destination) ??
            new Set<(updatedUser: any) => void>();
        listeners.add(callback);
        this.profileUpdateListeners.set(destination, listeners);

        if (!this.client?.connected) {
            console.error(
                "🔴 WebSocket not connected, cannot subscribe to profile updates",
            );
            return;
        }

        console.log("🟡 Destination:", destination);

        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) {
            console.log(`🟠 Already subscribed to ${destination}`);
            return;
        }

        console.log("🟡 Creating subscription to", destination);
        const subscription = this.client.subscribe(
            destination,
            (message: IMessage) => {
                console.log("🟢🟢🟢 RECEIVED MESSAGE FROM WEBSOCKET 🟢🟢🟢");
                console.log("📨 Message object:", message);
                console.log("📨 Message headers:", message.headers);
                console.log("📨 Raw body string:", message.body);
                console.log("📨 Body length:", message.body.length);
                console.log(
                    "📨 Body first 100 chars:",
                    message.body.substring(0, 100),
                );

                try {
                    const updatedUser = JSON.parse(message.body);
                    console.log("✅ Successfully parsed:", updatedUser);
                    console.log("✅ Calling callbacks with:", updatedUser);
                    const currentListeners =
                        this.profileUpdateListeners.get(destination);
                    if (!currentListeners) return;
                    currentListeners.forEach((listener) => {
                        listener(updatedUser);
                    });
                } catch (error) {
                    console.error(`🔴 Error parsing profile update:`, error);
                    console.error("🔴 Failed to parse body:", message.body);
                }
            },
        );

        this.subscriptions.set(destination, subscription);
        console.log(`🟢 Subscribed to profile updates for ${phone}`);
    }

    /**
     * Unsubscribe from user profile updates
     *
     * @param phone - User's phone number (international format)
     */
    unsubscribeFromProfileUpdates(
        phone: string,
        callback?: (updatedUser: any) => void,
    ) {
        const destination = `/topic/user/${phone}/profile-update`;
        const listeners = this.profileUpdateListeners.get(destination);

        if (listeners) {
            if (callback) {
                listeners.delete(callback);
            } else {
                listeners.clear();
            }

            if (listeners.size > 0) {
                return;
            }
        }

        this.profileUpdateListeners.delete(destination);

        const subscription = this.subscriptions.get(destination);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
            console.log(`Unsubscribed from profile updates for ${phone}`);
        }
    }

    // ── Force logout realtime ──────────────────────────────────────────────

    /**
     * Subscribe để nhận sự kiện force-logout từ backend khi logoutAllDevices được gọi.
     * Topic: /topic/user/{phone}/force-logout
     *
     * @param phone - Số điện thoại quốc tế của user đang đăng nhập (ví dụ: +84912345678)
     * @param callback - Hàm được gọi ngay khi nhận được sự kiện force logout
     */
    subscribeToForceLogout(phone: string, callback: () => void) {
        const destination = `/topic/user/${phone}/force-logout`;

        // KHÔNG bail-out khi chưa connected, và KHÔNG yêu cầu phải connected mới
        // đăng ký. Chỉ cần factory đã đăng ký, syncSubscriptions() (chạy ở MỖI lần
        // onConnect/reconnect) sẽ tự tạo STOMP subscription ngay khi client kết nối.
        // Điều này loại bỏ:
        //  - Race: lúc gọi mà client đang reconnect (connected=false) -> trước đây
        //    bail sớm, không đăng ký gì -> không bao giờ subscribe lại.
        //  - Mất subscription sau reconnect: onWebSocketClose clear() subscriptions,
        //    chỉ những factory đã đăng ký mới được khôi phục.
        // (heartbeat 4s + SockJS khiến reconnect xảy ra rất thường xuyên.)
        if (this.subscriptionFactories.has(destination)) {
            // Đã đăng ký rồi -> đảm bảo đang được subscribe (idempotent) rồi thoát.
            this.syncSubscriptions();
            return;
        }

        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(
                destination,
                (message: IMessage) => {
                    try {
                        const payload = JSON.parse(message.body);
                        console.log("🔴 Force logout event received:", payload);
                        if (payload?.event === "FORCE_LOGOUT") {
                            callback();
                        }
                    } catch (error) {
                        console.error("Error parsing force-logout event:", error);
                    }
                },
            );
        });

        console.log(`🔒 Force-logout subscription registered for ${phone} (connected=${this.client?.connected ?? false})`);
    }

    /**
     * Unsubscribe khỏi sự kiện force-logout
     *
     * @param phone - Số điện thoại quốc tế của user
     */
    unsubscribeFromForceLogout(phone: string) {
        const destination = `/topic/user/${phone}/force-logout`;
        // Dùng removeSubscription để xóa cả factory đã đăng ký, tránh việc
        // syncSubscriptions tái lập lại subscription sau khi đã unsubscribe.
        if (this.subscriptions.has(destination) || this.subscriptionFactories.has(destination)) {
            this.removeSubscription(destination);
            console.log(`🔓 Unsubscribed from force-logout for ${phone}`);
        }
    }

    /**
     * Subscribe force-logout theo userId (kênh đáng tin cậy, không phụ thuộc
     * định dạng số điện thoại). Backend luôn broadcast tới
     * /topic/user/{userId}/force-logout khi logoutAllDevices được gọi.
     *
     * @param userId - ID của user đang đăng nhập
     * @param callback - Hàm được gọi ngay khi nhận được sự kiện force logout
     */
    subscribeToForceLogoutById(userId: number, callback: () => void) {
        const destination = `/topic/user/${userId}/force-logout`;

        // Giống subscribeToForceLogout: chỉ cần factory được đăng ký,
        // syncSubscriptions() sẽ tự subscribe ngay khi client kết nối.
        if (this.subscriptionFactories.has(destination)) {
            this.syncSubscriptions();
            return;
        }

        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(
                destination,
                (message: IMessage) => {
                    try {
                        const payload = JSON.parse(message.body);
                        console.log("🔴 Force logout event received (by id):", payload);
                        if (payload?.event === "FORCE_LOGOUT") {
                            callback();
                        }
                    } catch (error) {
                        console.error("Error parsing force-logout event:", error);
                    }
                },
            );
        });

        console.log(`🔒 Force-logout (by id) subscription registered for ${userId} (connected=${this.client?.connected ?? false})`);
    }

    /**
     * Unsubscribe khỏi sự kiện force-logout theo userId
     *
     * @param userId - ID của user
     */
    unsubscribeFromForceLogoutById(userId: number) {
        const destination = `/topic/user/${userId}/force-logout`;
        if (this.subscriptions.has(destination) || this.subscriptionFactories.has(destination)) {
            this.removeSubscription(destination);
            console.log(`🔓 Unsubscribed from force-logout (by id) for ${userId}`);
        }
    }

    /**
     * Force-logout theo NỀN TẢNG: chỉ nhận khi có phiên mới CÙNG nền tảng đăng nhập
     * (web đá web). Tách khỏi topic force-logout chung (admin khóa / logout-all / đổi
     * mật khẩu) vốn đá mọi nền tảng.
     */
    subscribeToForceLogoutByPlatform(userId: number, platform: string, callback: () => void) {
        const destination = `/topic/user/${userId}/force-logout/${platform}`;
        if (this.subscriptionFactories.has(destination)) {
            this.syncSubscriptions();
            return;
        }
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }
            return client.subscribe(destination, (message: IMessage) => {
                try {
                    const payload = JSON.parse(message.body);
                    if (payload?.event === "FORCE_LOGOUT") {
                        callback();
                    }
                } catch (error) {
                    console.error("Error parsing force-logout (platform) event:", error);
                }
            });
        });
    }

    unsubscribeFromForceLogoutByPlatform(userId: number, platform: string) {
        const destination = `/topic/user/${userId}/force-logout/${platform}`;
        if (this.subscriptions.has(destination) || this.subscriptionFactories.has(destination)) {
            this.removeSubscription(destination);
        }
    }

    // ── Page realtime ─────────────────────────────────────────────────────

    subscribeToPagePosts(pageId: number, onEvent: (event: Record<string, unknown>) => void) {
        if (!this.client?.connected) return;
        const destination = `/topic/page/${pageId}/posts`;
        if (this.subscriptions.has(destination)) return;
        const sub = this.client.subscribe(destination, (msg: IMessage) => {
            try { onEvent(JSON.parse(msg.body) as Record<string, unknown>); } catch { /* ignore */ }
        });
        this.subscriptions.set(destination, sub);
    }

    unsubscribeFromPagePosts(pageId: number) {
        const destination = `/topic/page/${pageId}/posts`;
        this.subscriptions.get(destination)?.unsubscribe();
        this.subscriptions.delete(destination);
    }

    subscribeToPageList(onEvent: (event: Record<string, unknown>) => void) {
        if (!this.client?.connected) return;
        const destination = `/topic/pages`;
        if (this.subscriptions.has(destination)) return;
        const sub = this.client.subscribe(destination, (msg: IMessage) => {
            try { onEvent(JSON.parse(msg.body) as Record<string, unknown>); } catch { /* ignore */ }
        });
        this.subscriptions.set(destination, sub);
    }

    unsubscribeFromPageList() {
        const destination = `/topic/pages`;
        this.subscriptions.get(destination)?.unsubscribe();
        this.subscriptions.delete(destination);
    }

    subscribeToPageMembers(pageId: number, onEvent: (event: Record<string, unknown>) => void) {
        if (!this.client?.connected) return;
        const destination = `/topic/page/${pageId}/members`;
        if (this.subscriptions.has(destination)) return;
        const sub = this.client.subscribe(destination, (msg: IMessage) => {
            try { onEvent(JSON.parse(msg.body) as Record<string, unknown>); } catch { /* ignore */ }
        });
        this.subscriptions.set(destination, sub);
    }

    unsubscribeFromPageMembers(pageId: number) {
        const destination = `/topic/page/${pageId}/members`;
        this.subscriptions.get(destination)?.unsubscribe();
        this.subscriptions.delete(destination);
    }

    subscribeToUserPageEvents(userId: number, onEvent: (event: Record<string, unknown>) => void) {
        if (!this.client?.connected) return;
        const destination = `/topic/user/${userId}/page-events`;
        if (this.subscriptions.has(destination)) return;
        const sub = this.client.subscribe(destination, (msg: IMessage) => {
            try { onEvent(JSON.parse(msg.body) as Record<string, unknown>); } catch { /* ignore */ }
        });
        this.subscriptions.set(destination, sub);
    }

    unsubscribeFromUserPageEvents(userId: number) {
        const destination = `/topic/user/${userId}/page-events`;
        this.subscriptions.get(destination)?.unsubscribe();
        this.subscriptions.delete(destination);
    }

    subscribeToStory(storyId: string, onEvent: (event: any) => void) {
        if (!this.client?.connected) return;
        const destination = `/topic/stories/${storyId}`;
        if (this.subscriptions.has(destination)) return;
        const sub = this.client.subscribe(destination, (msg: IMessage) => {
            try { onEvent(JSON.parse(msg.body)); } catch { /* ignore */ }
        });
        this.subscriptions.set(destination, sub);
    }

    unsubscribeFromStory(storyId: string) {
        const destination = `/topic/stories/${storyId}`;
        this.subscriptions.get(destination)?.unsubscribe();
        this.subscriptions.delete(destination);
    }
}

/**
 * ============================================================================
 * SINGLETON PATTERN
 * ============================================================================
 *
 * Tạo 1 instance duy nhất của WebSocketService
 *
 * Lý do sử dụng Singleton:
 * - Đảm bảo chỉ có 1 WebSocket connection duy nhất trong toàn bộ app
 * - Nhiều component có thể share cùng 1 connection
 * - Tránh tạo nhiều connection gây lãng phí tài nguyên
 *
 * Cách sử dụng trong component:
 *
 * import websocketService from '@/services/websocket';
 *
 * useEffect(() => {
 *   // Kết nối
 *   const setupWebSocket = async () => {
 *     await websocketService.connect();
 *     websocketService.subscribeToConversation(1, handleMessage);
 *   };
 *   setupWebSocket();
 *
 *   // Cleanup khi unmount
 *   return () => {
 *     websocketService.unsubscribeFromConversation(1);
 *   };
 * }, []);
 */
const websocketService = new WebSocketService();

export default websocketService;
