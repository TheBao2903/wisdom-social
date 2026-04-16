/**
 * Import các thư viện cần thiết:
 * - Client: STOMP client để quản lý kết nối WebSocket
 * - IMessage: Interface cho message từ STOMP
 * - SockJS: Thư viện fallback cho WebSocket (hỗ trợ các browser cũ)
 */
import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { Message } from "./chatService";

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
    | "end-call";

export interface CallSignalPayload {
    event: CallSignalEvent;
    conversationId: number;
    callId: string;
    callType: "audio" | "video";
    fromUserId: number;
    targetUserId: number;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
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
    | "TYPING" // User đang soạn tin nhắn
    | "ROOM_CREATED" // Phòng chat mới
    | "ROOM_UPDATED" // Phòng chat được cập nhật
    | "ROOM_DELETED" // Phòng chat bị xóa
    | "MEMBER_ADDED" // Thành viên mới tham gia
    | "MEMBER_REMOVED" // Thành viên rời khỏi
    | "MEMBER_ROLE_CHANGED" // Thay đổi vai trò thành viên
    | "PIN_MESSAGE"
    | "UPIN_MESSAGE"
    | "MEMBER_UPDATED";

export interface PinUpdatedEvent {
    domainEventType: "PIN_MESSAGE" | "UPIN_MESSAGE";
    conversationId: number;
    currentPins: Array<{
        messageId: string;
        pinnerId: number;
        pinnedAt: string;
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
    // Loại event - luôn là "ROOM_UPDATED"
    type: "ROOM_UPDATED";

    // ID của conversation được cập nhật - nằm trong event, KHÔNG nằm trong lastMessage
    conversationId: number;

    // Thông tin tin nhắn cuối cùng - dùng để cập nhật sidebar
    // LƯU Ý: Backend không gửi conversationId trong lastMessage
    lastMessage: {
        lastMessageContent: string; // Nội dung tin nhắn
        lastMessageType: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "AUDIO" | "CALL"; // Loại tin nhắn
        lastSenderId: number; // ID người gửi
        lastSenderName: string; // Tên người gửi
        lastMessageAt: string; // Thời điểm gửi (ISO string)
        read: boolean; // Đã đọc hay chưa - luôn là false khi mới nhận từ WebSocket
    };
}

/**
 * Type alias cho dữ liệu cập nhật conversation
 * Để backward compatible với code hiện tại
 */
export type LastMessageUpdate = ConversationUpdatedEvent["lastMessage"];
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

    private callEventListeners: Map<
        number,
        Set<(event: CallSignalPayload) => void>
    > = new Map();

    /**
     * Promise theo dõi trạng thái kết nối
     * - null: chưa kết nối hoặc đã kết nối xong
     * - Promise<void>: đang trong quá trình kết nối
     * Dùng để tránh nhiều component cùng gọi connect() tạo duplicate connections
     */
    private connectPromise: Promise<void> | null = null;

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
                 * Endpoint: http://localhost:8080/ws (backend Spring Boot)
                 */
                webSocketFactory: () => {
                    console.log("🟡 Creating SockJS connection to http://localhost:8080/ws");
                    return new SockJS("http://localhost:8080/ws");
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

                /**
                 * onConnect: Callback khi STOMP connection thành công
                 * Được gọi sau khi nhận được CONNECTED frame từ server
                 * Lúc này có thể bắt đầu subscribe các topic
                 */
                onConnect: () => {
                    console.log("🟢🟢🟢 STOMP Connected to server 🟢🟢🟢");
                    this.connectPromise = null; // Reset promise
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
        if (this.client) {
            // Unsubscribe tất cả subscriptions trước khi disconnect
            this.subscriptions.forEach((subscription) => {
                subscription.unsubscribe();
            });
            this.subscriptions.clear();

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
    ) {
        // BƯỚC 1: Kiểm tra client đã kết nối chưa
        // client.connected = true chỉ khi STOMP handshake hoàn tất
        if (!this.client?.connected) {
            console.error("WebSocket not connected, cannot subscribe");
            return;
        }

        // BƯỚC 2: Tạo destination theo format của backend: /topic/conversation/{id}
        const destination = `/topic/conversation/${conversationId}`;

        // BƯỚC 3: Kiểm tra đã subscribe destination này chưa để tránh duplicate
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) {
            // console.log(`Already subscribed to ${destination}`);
            return;
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
        const subscription = this.client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    const event = JSON.parse(message.body) as
                        | MessageCreatedEvent
                        | MessageRecalledEvent
                        | MessageSeenEvent
                        | TypingEvent;

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
                    }
                } catch (error) {
                    console.error("Error parsing message:", error);
                }
            },
        );

        // BƯỚC 5: Lưu subscription vào Map để có thể unsubscribe sau
        this.subscriptions.set(destination, subscription);
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
        const subscription = this.subscriptions.get(destination);

        if (subscription) {
            // Gửi UNSUBSCRIBE frame tới server
            subscription.unsubscribe();

            // Xóa khỏi Map
            this.subscriptions.delete(destination);
            // console.log(`Unsubscribed from ${destination}`);
        }
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

        const subscription = this.client.subscribe(
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

        this.subscriptions.set(destination, subscription);
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

        const subscription = this.client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    const event = JSON.parse(
                        message.body,
                    ) as MemberUpdatedEvent;
                    onMemberUpdated(event);
                } catch (error) {
                    console.error("Error parsing member update:", error);
                }
            },
        );

        this.subscriptions.set(destination, subscription);
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
        ) => void,
    ) {
        // BƯỚC 1: Kiểm tra kết nối WebSocket
        // Phải đảm bảo STOMP handshake đã hoàn tất trước khi subscribe
        if (!this.client?.connected) {
            console.error(
                "WebSocket not connected, cannot subscribe to user conversations",
            );
            return;
        }

        // BƯỚC 2: Tạo destination theo format của backend
        // Format: /topic/user/{userId}/conversations
        // VD: /topic/user/1/conversations cho user có ID = 1
        const destination = `/topic/user/${userId}/conversations`;

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
        const subscription = this.client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    // Parse JSON body thành ConversationUpdatedEvent
                    // Backend gửi: { type: "ROOM_UPDATED", conversationId: 123, lastMessage: {...} }
                    const event: ConversationUpdatedEvent = JSON.parse(
                        message.body,
                    );

                    // Trích xuất conversationId từ event (KHÔNG nằm trong lastMessage)
                    const conversationId = event.conversationId;

                    // Trích xuất lastMessage từ event
                    // lastMessage KHÔNG chứa conversationId, chỉ chứa: lastMessageContent, lastSenderName, etc.
                    const lastMessageData: LastMessageUpdate =
                        event.lastMessage;

                    // Gọi callback với 2 tham số riêng biệt
                    // - conversationId: Để biết cập nhật conversation nào
                    // - lastMessageData: Thông tin tin nhắn mới nhất
                    callback(conversationId, lastMessageData);
                } catch (error) {
                    console.error("Error parsing conversation update:", error);
                }
            },
        );

        // BƯỚC 5: Lưu subscription vào Map để có thể unsubscribe sau này
        this.subscriptions.set(destination, subscription);
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
    unsubscribeFromUserConversations(userId: number) {
        // Tạo lại destination để tìm subscription
        const destination = `/topic/user/${userId}/conversations`;
        const subscription = this.subscriptions.get(destination);

        if (subscription) {
            // Gửi UNSUBSCRIBE frame tới server
            subscription.unsubscribe();

            // Xóa khỏi Map để giải phóng bộ nhớ
            this.subscriptions.delete(destination);
            console.log(`Unsubscribed from ${destination}`);
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
        if (!this.client?.connected) {
            console.error("WebSocket not connected, cannot subscribe to topic:", destination);
            return;
        }

        // Check if already subscribed
        const existingSubscription = this.subscriptions.get(destination);
        if (existingSubscription) {
            console.log(`Already subscribed to ${destination}`);
            return;
        }

        const subscription = this.client.subscribe(
            destination,
            (message: IMessage) => {
                try {
                    // Try to parse as JSON, fallback to raw string
                    let parsedMessage;
                    try {
                        parsedMessage = JSON.parse(message.body);
                    } catch {
                        parsedMessage = message.body;
                    }
                    callback(parsedMessage);
                } catch (error) {
                    console.error(`Error handling message from ${destination}:`, error);
                }
            }
        );

        this.subscriptions.set(destination, subscription);
        console.log(`Subscribed to ${destination}`);
    }

    /**
     * Unsubscribe from a generic topic
     *
     * @param destination - Topic destination to unsubscribe from
     */
    unsubscribeFromTopic(destination: string) {
        const subscription = this.subscriptions.get(destination);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
            console.log(`Unsubscribed from ${destination}`);
        }
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

        if (!this.client?.connected) {
            console.error(
                "🔴 WebSocket not connected, cannot subscribe to profile updates",
            );
            return;
        }

        const destination = `/topic/user/${phone}/profile-update`;
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
                console.log("📨 Body first 100 chars:", message.body.substring(0, 100));

                try {
                    const updatedUser = JSON.parse(message.body);
                    console.log("✅ Successfully parsed:", updatedUser);
                    console.log("✅ Calling callback with:", updatedUser);
                    callback(updatedUser);
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
    unsubscribeFromProfileUpdates(phone: string) {
        const destination = `/topic/user/${phone}/profile-update`;
        const subscription = this.subscriptions.get(destination);

        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(destination);
            console.log(`Unsubscribed from profile updates for ${phone}`);
        }
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
