import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { DeviceEventEmitter } from "react-native";
import type {
    Conversation,
    ConversationCreatedEvent,
    DirectBlockStatusChangedEvent,
    ConversationMembershipEvent,
    ConversationUpdatedEvent,
    GroupDisbandedEvent,
    JoinRequestProcessedEvent,
    LastMessage,
    MemberUpdatedEvent,
    MemberAccountLockChangedEvent,
    Message,
    MessageCreatedEvent,
    MessageRecalledEvent,
    MessageSeenEvent,
    NewJoinRequestEvent,
    PinUpdatedEvent,
    TypingEvent,
    MessageReactionEvent,
    PollResponse,
    PollUpdatedEvent,
} from "@/types/chat";
import apiClient from "@/api/apiClient";

type ConversationEvent =
    | MessageCreatedEvent
    | MessageRecalledEvent
    | MessageSeenEvent
    | TypingEvent
    | MessageReactionEvent
    | PollUpdatedEvent;

type ConversationSnapshot = Conversation & {
    processedJoinRequestId?: number;
};

type UserConversationEvent =
    | ConversationUpdatedEvent
    | ConversationCreatedEvent
    | ConversationMembershipEvent
    | GroupDisbandedEvent
    | JoinRequestProcessedEvent
    | NewJoinRequestEvent;

type UserConversationUpdateHandler = (
    conversationId: number,
    lastMessage: ConversationUpdatedEvent["lastMessage"],
    conversation?: ConversationSnapshot,
) => void;

interface UserConversationListener {
    onConversationUpdated: UserConversationUpdateHandler;
    onDisbanded?: (conversationId: number) => void;
}

function toLastMessageUpdate(conversation: Conversation): LastMessage | null {
    return conversation.lastMessage ?? null;
}

function buildFallbackLastMessageUpdate(conversation: Conversation): LastMessage {
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
    domainEventType?: string,
): LastMessage {
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

function toFiniteNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}
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

function resolveWsBrokerUrl(): string {
    const baseUrl = apiClient.defaults.baseURL ?? "http://10.0.2.2:8080/api";
    const apiRoot = baseUrl.replace(/\/?api\/?$/, "");
    const wsRoot = apiRoot.replace(/^http/i, "ws");
    return `${wsRoot}/ws`;
}

function resolveSockJsHttpUrl(): string {
    const baseUrl = apiClient.defaults.baseURL ?? "http://10.0.2.2:8080/api";
    const apiRoot = baseUrl.replace(/\/?api\/?$/, "");
    return `${apiRoot}/ws`;
}

const normalizePresencePhone = (phone?: string | null): string | null => {
    if (!phone) return null;
    const normalized = phone.trim().replace(/\s+/g, "");
    if (!normalized) return null;
    if (normalized.startsWith("+84")) return normalized;
    if (normalized.startsWith("0")) return `+84${normalized.substring(1)}`;
    if (normalized.startsWith("84")) return `+${normalized}`;
    return `+84${normalized}`;
};

const WS_DEBUG_PREFIX = "[RECALL_DEBUG][mobile][chatWebsocketService]";

class ChatWebsocketService {
    private client: Client | null = null;
    private subscriptions = new Map<string, { unsubscribe: () => void }>();
    private subscriptionFactories = new Map<
        string,
        () => { unsubscribe: () => void }
    >();
    private connectPromise: Promise<void> | null = null;
    private callEventListeners = new Map<
        number,
        Set<(event: CallSignalPayload) => void>
    >();
    private userConversationListeners = new Map<
        number,
        Map<UserConversationUpdateHandler, UserConversationListener>
    >();
    private conversationSeenListeners = new Map<
        number,
        Set<(event: MessageSeenEvent) => void>
    >();
    private nextUniqueSubscriptionId = 0;
    private presenceLoginPhone: string | null = null;
    private presenceHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private presenceEventListeners = new Map<
        number,
        Set<(event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void>
    >();
    private topicListeners = new Map<string, Set<(body: string) => void>>();

    setPresenceIdentity(phone?: string | null): void {
        // Phone duoc gui qua STOMP CONNECT header "login" de backend gan session voi user.
        const nextLoginPhone = normalizePresencePhone(phone);
        if (this.presenceLoginPhone === nextLoginPhone) return;

        const hadActiveConnection = Boolean(this.client?.connected || this.connectPromise);
        this.presenceLoginPhone = nextLoginPhone;

        // Mobile co nhieu hook co the connect websocket truoc khi AppContext nap xong phone.
        // Neu da connect ma chua co header login, backend se khong the register presence.
        // Reconnect nhe va giu subscriptionFactories de cac topic chat/call/presence duoc sync lai.
        if (hadActiveConnection) {
            this.reconnectWithCurrentIdentity();
        }
    }

    private reconnectWithCurrentIdentity(): void {
        this.stopPresenceHeartbeat();

        const reconnect = async () => {
            if (this.connectPromise) {
                await this.connectPromise.catch(() => undefined);
            }

            const previousClient = this.client;
            this.subscriptions.forEach((subscription) => {
                try {
                    subscription.unsubscribe();
                } catch {
                    // ignore stale subscription handles during reconnect
                }
            });
            this.subscriptions.clear();
            this.client = null;

            if (previousClient) {
                await previousClient.deactivate().catch(() => undefined);
            }

            if (this.presenceLoginPhone) {
                await this.connect().catch((error) => {
                    console.log(`${WS_DEBUG_PREFIX} presence reconnect failed`, {
                        error,
                    });
                });
            }
        };

        void reconnect();
    }

    private getPresenceConnectHeaders(): Record<string, string> | undefined {
        return this.presenceLoginPhone ? { login: this.presenceLoginPhone } : undefined;
    }

    private startPresenceHeartbeat(): void {
        this.stopPresenceHeartbeat();
        if (!this.presenceLoginPhone) return;

        // Heartbeat presence di tren WebSocket dang mo, khong spam REST dinh ky.
        this.presenceHeartbeatTimer = setInterval(() => {
            if (!this.client?.connected) return;
            this.client.publish({
                destination: "/app/presence/heartbeat",
                body: "{}",
            });
        }, 30000);
    }

    private stopPresenceHeartbeat(): void {
        if (this.presenceHeartbeatTimer) {
            clearInterval(this.presenceHeartbeatTimer);
            this.presenceHeartbeatTimer = null;
        }
    }

    private syncSubscriptions(): void {
        if (!this.client?.connected) return;

        this.subscriptionFactories.forEach((factory, destination) => {
            if (this.subscriptions.has(destination)) return;

            try {
                const subscription = factory();
                this.subscriptions.set(destination, subscription);
                console.log(`${WS_DEBUG_PREFIX} synced subscription`, {
                    destination,
                });
            } catch {
                console.log(`${WS_DEBUG_PREFIX} sync subscription failed`, {
                    destination,
                });
            }
        });
    }

    private registerSubscription(
        destination: string,
        factory: () => { unsubscribe: () => void },
    ): void {
        this.subscriptionFactories.set(destination, factory);

        const activeSubscription = this.subscriptions.get(destination);
        if (activeSubscription) {
            activeSubscription.unsubscribe();
            this.subscriptions.delete(destination);
        }

        this.syncSubscriptions();
    }

    private removeSubscription(destination: string): void {
        const activeSubscription = this.subscriptions.get(destination);
        if (activeSubscription) {
            activeSubscription.unsubscribe();
            this.subscriptions.delete(destination);
        }

        this.subscriptionFactories.delete(destination);
    }

    private connectWithBrokerUrl(brokerURL: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;

                console.log(`${WS_DEBUG_PREFIX} connect timeout`, {
                    brokerURL,
                });

                if (this.client) {
                    void this.client.deactivate();
                    this.client = null;
                }

                reject(new Error(`WebSocket connect timeout: ${brokerURL}`));
            }, 6000);

            this.client = new Client({
                brokerURL,
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                connectHeaders: this.getPresenceConnectHeaders(),
                debug: (message) => {
                    if (
                        message.includes("CONNECTED") ||
                        message.includes("ERROR") ||
                        message.includes("SUBSCRIBE")
                    ) {
                        console.log(`${WS_DEBUG_PREFIX} stomp`, { message });
                    }
                },
                onConnect: () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);

                    console.log(`${WS_DEBUG_PREFIX} onConnect`, {
                        brokerURL,
                    });

                    this.startPresenceHeartbeat();
                    this.syncSubscriptions();
                    resolve();
                },
                onStompError: (frame) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);

                    console.log(`${WS_DEBUG_PREFIX} onStompError`, {
                        brokerURL,
                        headers: frame.headers,
                        body: frame.body,
                    });

                    reject(frame);
                },
                onWebSocketError: (event) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);

                    console.log(`${WS_DEBUG_PREFIX} onWebSocketError`, {
                        brokerURL,
                        event,
                    });

                    reject(event);
                },
                onWebSocketClose: () => {
                    console.log(`${WS_DEBUG_PREFIX} onWebSocketClose`, {
                        brokerURL,
                    });
                    this.subscriptions.clear();

                    if (!settled) {
                        settled = true;
                        clearTimeout(timeout);
                        reject(
                            new Error(
                                `WebSocket closed before connect: ${brokerURL}`,
                            ),
                        );
                    }
                },
            });

            this.client.activate();
        });
    }

    private connectWithSockJsUrl(sockJsUrl: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;

                console.log(`${WS_DEBUG_PREFIX} connect timeout`, {
                    sockJsUrl,
                    mode: "sockjs",
                });

                if (this.client) {
                    void this.client.deactivate();
                    this.client = null;
                }

                reject(new Error(`SockJS connect timeout: ${sockJsUrl}`));
            }, 6000);

            this.client = new Client({
                webSocketFactory: () =>
                    new SockJS(sockJsUrl, undefined, {
                        transports: ["websocket"],
                    }),
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                connectHeaders: this.getPresenceConnectHeaders(),
                debug: (message) => {
                    if (
                        message.includes("CONNECTED") ||
                        message.includes("ERROR") ||
                        message.includes("SUBSCRIBE")
                    ) {
                        console.log(`${WS_DEBUG_PREFIX} stomp`, {
                            message,
                            mode: "sockjs",
                        });
                    }
                },
                onConnect: () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);

                    console.log(`${WS_DEBUG_PREFIX} onConnect`, {
                        sockJsUrl,
                        mode: "sockjs",
                    });

                    this.startPresenceHeartbeat();
                    this.syncSubscriptions();
                    resolve();
                },
                onStompError: (frame) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);

                    console.log(`${WS_DEBUG_PREFIX} onStompError`, {
                        sockJsUrl,
                        mode: "sockjs",
                        headers: frame.headers,
                        body: frame.body,
                    });

                    reject(frame);
                },
                onWebSocketError: (event) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);

                    console.log(`${WS_DEBUG_PREFIX} onWebSocketError`, {
                        sockJsUrl,
                        mode: "sockjs",
                        event,
                    });

                    reject(event);
                },
                onWebSocketClose: () => {
                    console.log(`${WS_DEBUG_PREFIX} onWebSocketClose`, {
                        sockJsUrl,
                        mode: "sockjs",
                    });
                    this.subscriptions.clear();

                    if (!settled) {
                        settled = true;
                        clearTimeout(timeout);
                        reject(
                            new Error(
                                `SockJS closed before connect: ${sockJsUrl}`,
                            ),
                        );
                    }
                },
            });

            this.client.activate();
        });
    }

    connect(): Promise<void> {
        if (this.connectPromise) return this.connectPromise;
        if (this.client?.connected) return Promise.resolve();

        const wsBaseUrl = resolveWsBrokerUrl();
        const sockJsUrl = resolveSockJsHttpUrl();
        const rawBrokerPrimary = `${wsBaseUrl}/websocket`;
        const rawBrokerFallback = wsBaseUrl;

        const candidates: (
            | { mode: "sockjs"; sockJsUrl: string }
            | { mode: "raw"; brokerURL: string }
        )[] = [
                { mode: "sockjs", sockJsUrl },
                { mode: "raw", brokerURL: rawBrokerPrimary },
                { mode: "raw", brokerURL: rawBrokerFallback },
            ];

        const candidateLabels = Array.from(
            new Set(
                candidates.map((candidate) =>
                    candidate.mode === "sockjs"
                        ? `sockjs:${candidate.sockJsUrl}`
                        : `raw:${candidate.brokerURL}`,
                ),
            ),
        );

        console.log(`${WS_DEBUG_PREFIX} connect()`, {
            candidateBrokerUrls: candidateLabels,
        });

        this.subscriptions.forEach((subscription) =>
            subscription.unsubscribe(),
        );
        this.subscriptions.clear();

        this.connectPromise = (async () => {
            let lastError: unknown = null;

            for (const candidate of candidates) {
                try {
                    if (this.client) {
                        void this.client.deactivate();
                        this.client = null;
                    }

                    if (candidate.mode === "sockjs") {
                        await this.connectWithSockJsUrl(candidate.sockJsUrl);
                    } else {
                        await this.connectWithBrokerUrl(candidate.brokerURL);
                    }

                    return;
                } catch (error) {
                    lastError = error;
                    console.log(`${WS_DEBUG_PREFIX} connect attempt failed`, {
                        candidate:
                            candidate.mode === "sockjs"
                                ? `sockjs:${candidate.sockJsUrl}`
                                : `raw:${candidate.brokerURL}`,
                        error,
                    });
                }
            }

            throw (
                lastError ??
                new Error("All websocket broker connection attempts failed")
            );
        })().finally(() => {
            this.connectPromise = null;
        });

        return this.connectPromise;
    }

    disconnect(): void {
        this.stopPresenceHeartbeat();
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions.clear();
        this.subscriptionFactories.clear();
        this.callEventListeners.clear();
        this.presenceEventListeners.clear();

        if (this.client) {
            void this.client.deactivate();
            this.client = null;
        }
    }

    isConnected(): boolean {
        return this.client?.connected ?? false;
    }

    subscribeToConversation(
        conversationId: number,
        onMessage: (message: Message) => void,
        onRecall?: (messageId: string) => void,
        onSeen?: (event: MessageSeenEvent) => void,
        onTyping?: (event: TypingEvent) => void,
        onReaction?: (message: Message) => void,
        onPollUpdated?: (poll: PollResponse) => void,
    ): void {
        const destination = `/topic/conversation/${conversationId}`;
        console.log(`${WS_DEBUG_PREFIX} subscribeToConversation`, {
            conversationId,
            destination,
            connected: this.client?.connected ?? false,
        });
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (message: IMessage) => {
                try {
                    const rawBody = message.body;
                    const raw = JSON.parse(message.body) as
                        | ConversationEvent
                        | {
                            payload?: unknown;
                            data?: unknown;
                            domainEventType?: unknown;
                            type?: unknown;
                        };

                    const container =
                        (raw as { payload?: unknown }).payload ??
                        (raw as { data?: unknown }).data ??
                        raw;

                    const domainType = String(
                        (
                            container as {
                                domainEventType?: unknown;
                                type?: unknown;
                            }
                        ).domainEventType ??
                        (
                            container as {
                                domainEventType?: unknown;
                                type?: unknown;
                            }
                        ).type ??
                        (
                            raw as {
                                domainEventType?: unknown;
                                type?: unknown;
                            }
                        ).domainEventType ??
                        (
                            raw as {
                                domainEventType?: unknown;
                                type?: unknown;
                            }
                        ).type ??
                        "",
                    );

                    if (domainType === "MESSAGE_CREATED") {
                        console.log(
                            `${WS_DEBUG_PREFIX} MESSAGE_CREATED received`,
                            {
                                destination,
                                conversationId,
                            },
                        );
                        const createdMessage = (
                            container as { messageResponse?: Message }
                        ).messageResponse;
                        if (createdMessage) {
                            onMessage(createdMessage);
                        }
                        return;
                    }

                    if (domainType === "MESSAGE_REACTION") {
                        const payload = (
                            container as { messageResponse?: Message }
                        ).messageResponse;
                        if (payload) {
                            onReaction?.(payload);
                        }
                        return;
                    }

                    if (domainType === "POLL_UPDATED") {
                        const payload = (container as { poll?: PollResponse }).poll;
                        if (payload) {
                            onPollUpdated?.(payload);
                        }
                        return;
                    }

                    if (domainType === "MESSAGE_RECALLED") {
                        const recalledPayload = (
                            container as {
                                messageRecalledResponse?: {
                                    messageId?: unknown;
                                    conversationId?: unknown;
                                };
                            }
                        ).messageRecalledResponse;
                        const recalledMessageId =
                            recalledPayload?.messageId ??
                            (
                                container as {
                                    messageId?: unknown;
                                }
                            ).messageId;

                        if (typeof recalledMessageId === "string") {
                            console.log(
                                "[RECALL_DEBUG][mobile][chatWebsocketService] MESSAGE_RECALLED received",
                                {
                                    destination,
                                    conversationId,
                                    domainType,
                                    messageId: recalledMessageId,
                                    payloadConversationId:
                                        recalledPayload?.conversationId,
                                    rawBody,
                                },
                            );
                            onRecall?.(recalledMessageId);
                        } else {
                            console.log(
                                "[RECALL_DEBUG][mobile][chatWebsocketService] MESSAGE_RECALLED missing messageId",
                                {
                                    destination,
                                    conversationId,
                                    domainType,
                                    rawBody,
                                },
                            );
                        }
                        return;
                    }

                    if (domainType === "MESSAGE_SEEN") {
                        onSeen?.(container as MessageSeenEvent);
                        return;
                    }

                    if (domainType === "TYPING") {
                        onTyping?.(container as TypingEvent);
                    }
                } catch {
                    console.log(
                        `${WS_DEBUG_PREFIX} parse error on conversation event`,
                        {
                            destination,
                            conversationId,
                            body: message.body,
                        },
                    );
                }
            });
        });
    }

    unsubscribeFromConversation(conversationId: number): void {
        const destination = `/topic/conversation/${conversationId}`;
        this.removeSubscription(destination);
    }

    subscribeToConversationSeen(
        conversationId: number,
        onSeen: (event: MessageSeenEvent) => void,
    ): void {
        const listeners =
            this.conversationSeenListeners.get(conversationId) ?? new Set();
        listeners.add(onSeen);
        this.conversationSeenListeners.set(conversationId, listeners);

        const destination = `/topic/conversation/${conversationId}`;
        const key = `${destination}::seen-sync`;

        if (this.subscriptionFactories.has(key)) {
            this.syncSubscriptions();
            return;
        }

        this.subscriptionFactories.set(key, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (message: IMessage) => {
                try {
                    const raw = JSON.parse(message.body) as
                        | MessageSeenEvent
                        | { payload?: unknown; data?: unknown };
                    const container =
                        (raw as { payload?: unknown }).payload ??
                        (raw as { data?: unknown }).data ??
                        raw;
                    const domainType = String(
                        (container as { domainEventType?: unknown; type?: unknown })
                            .domainEventType ??
                            (container as { domainEventType?: unknown; type?: unknown })
                                .type ??
                            "",
                    );

                    if (domainType === "MESSAGE_SEEN") {
                        this.conversationSeenListeners
                            .get(conversationId)
                            ?.forEach((listener) =>
                                listener(container as MessageSeenEvent),
                            );
                    }
                } catch {
                    // no-op: this lightweight listener only cares about MESSAGE_SEEN.
                }
            });
        });

        if (this.client?.connected && !this.subscriptions.has(key)) {
            try {
                const subscription = this.subscriptionFactories.get(key)!();
                this.subscriptions.set(key, subscription);
            } catch {
                // syncSubscriptions will retry after reconnect.
            }
        }
    }

    unsubscribeFromConversationSeen(
        conversationId: number,
        onSeen?: (event: MessageSeenEvent) => void,
    ): void {
        const listeners = this.conversationSeenListeners.get(conversationId);
        if (listeners && onSeen) {
            listeners.delete(onSeen);
            if (listeners.size > 0) return;
        }

        this.conversationSeenListeners.delete(conversationId);
        this.removeSubscription(`/topic/conversation/${conversationId}::seen-sync`);
    }

    subscribeToConversationMessages(
        conversationId: number,
        onMessage: (message: Message) => void,
    ): () => void {
        const destination = `/topic/conversation/${conversationId}`;
        const key = `${destination}::message-watch::${++this.nextUniqueSubscriptionId}`;

        this.subscriptionFactories.set(key, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (message: IMessage) => {
                try {
                    const raw = JSON.parse(message.body) as
                        | ConversationEvent
                        | {
                              payload?: unknown;
                              data?: unknown;
                              domainEventType?: unknown;
                              type?: unknown;
                          };

                    const container =
                        (raw as { payload?: unknown }).payload ??
                        (raw as { data?: unknown }).data ??
                        raw;
                    const domainType = String(
                        (
                            container as {
                                domainEventType?: unknown;
                                type?: unknown;
                            }
                        ).domainEventType ??
                            (
                                container as {
                                    domainEventType?: unknown;
                                    type?: unknown;
                                }
                            ).type ??
                            (
                                raw as {
                                    domainEventType?: unknown;
                                    type?: unknown;
                                }
                            ).domainEventType ??
                            (
                                raw as {
                                    domainEventType?: unknown;
                                    type?: unknown;
                                }
                            ).type ??
                            "",
                    );

                    if (domainType !== "MESSAGE_CREATED") return;

                    const createdMessage = (
                        container as { messageResponse?: Message }
                    ).messageResponse;
                    if (createdMessage) {
                        onMessage(createdMessage);
                    }
                } catch {
                    // no-op
                }
            });
        });

        this.syncSubscriptions();

        return () => {
            this.removeSubscription(key);
        };
    }

    subscribeToConversationPins(
        conversationId: number,
        onPinUpdated: (event: PinUpdatedEvent) => void,
    ): void {
        const destination = `/topic/conversations/${conversationId}/pins`;
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (message: IMessage) => {
                try {
                    onPinUpdated(JSON.parse(message.body) as PinUpdatedEvent);
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromConversationPins(conversationId: number): void {
        const destination = `/topic/conversations/${conversationId}/pins`;
        this.removeSubscription(destination);
    }

    subscribeToConversationMembers(
        conversationId: number,
        onMemberUpdated: (event: MemberUpdatedEvent) => void,
        onAccountLockChanged?: (event: MemberAccountLockChangedEvent) => void,
        onDirectBlockStatusChanged?: (event: DirectBlockStatusChangedEvent) => void,
    ): void {
        const destination = `/topic/conversations/${conversationId}/members`;
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (message: IMessage) => {
                try {
                    const event = JSON.parse(message.body) as
                        | MemberUpdatedEvent
                        | MemberAccountLockChangedEvent
                        | DirectBlockStatusChangedEvent;
                    // Phân loại theo domainEventType. Mặc định coi như MEMBER_UPDATED
                    // để tương thích ngược với payload cũ.
                    if (event.domainEventType === "MEMBER_ACCOUNT_LOCK_CHANGED") {
                        onAccountLockChanged?.(
                            event as MemberAccountLockChangedEvent,
                        );
                    } else if (event.domainEventType === "DIRECT_BLOCK_STATUS_CHANGED") {
                        onDirectBlockStatusChanged?.(
                            event as DirectBlockStatusChangedEvent,
                        );
                    } else {
                        onMemberUpdated(event as MemberUpdatedEvent);
                    }
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromConversationMembers(conversationId: number): void {
        const destination = `/topic/conversations/${conversationId}/members`;
        this.removeSubscription(destination);
    }

    subscribeToPresence(
        currentUserId: number,
        callback: (event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void,
    ): void {
        const listeners =
            this.presenceEventListeners.get(currentUserId) ??
            new Set<(event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void>();
        listeners.add(callback);
        this.presenceEventListeners.set(currentUserId, listeners);

        const destination = `/topic/user/${currentUserId}/presence`;
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
                    const raw = JSON.parse(message.body);
                    const payload = raw?.payload ?? raw?.data ?? raw;
                    const userId = Number(payload?.userId);
                    if (!Number.isFinite(userId)) return;

                    // Event realtime chi cap nhat UI; snapshot ban dau lay qua REST.
                    const event = {
                        userId,
                        online: Boolean(payload?.online ?? payload?.isOnline),
                        lastActiveAt: payload?.lastActiveAt ?? null,
                    };
                    this.presenceEventListeners
                        .get(currentUserId)
                        ?.forEach((listener) => listener(event));
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromPresence(
        currentUserId: number,
        callback?: (event: { userId: number; online: boolean; lastActiveAt?: string | null }) => void,
    ): void {
        const listeners = this.presenceEventListeners.get(currentUserId);

        if (callback && listeners) {
            listeners.delete(callback);
            if (listeners.size > 0) return;
        }

        this.presenceEventListeners.delete(currentUserId);
        this.removeSubscription(`/topic/user/${currentUserId}/presence`);
    }

    subscribeToUserConversations(
        userId: number,
        onConversationUpdated: UserConversationUpdateHandler,
        onDisbanded?: (conversationId: number) => void,
    ): void {
        const existingListeners =
            this.userConversationListeners.get(userId) ?? new Map();
        existingListeners.set(onConversationUpdated, {
            onConversationUpdated,
            onDisbanded,
        });
        this.userConversationListeners.set(userId, existingListeners);

        const destination = `/topic/user/${userId}/conversations`;
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
                    const rawPayload = JSON.parse(message.body) as
                        | UserConversationEvent
                        | { payload?: unknown; data?: unknown };
                    const payload = (
                        (rawPayload as { payload?: unknown }).payload ??
                        (rawPayload as { data?: unknown }).data ??
                        rawPayload
                    ) as UserConversationEvent;
                    const listeners = Array.from(
                        this.userConversationListeners
                            .get(userId)
                            ?.values() ?? [],
                    );

                    const blockedMembersPayload = payload as {
                        domainEventType?: string;
                        conversationId?: unknown;
                    };
                    const blockedConversationId = toFiniteNumber(
                        blockedMembersPayload.conversationId,
                    );
                    if (
                        blockedMembersPayload.domainEventType ===
                            "CONVERSATION_BLOCKED_MEMBERS_UPDATED" &&
                        blockedConversationId !== null
                    ) {
                        DeviceEventEmitter.emit(
                            "conversation-blocked-members-updated",
                            {
                                ...blockedMembersPayload,
                                conversationId: blockedConversationId,
                            },
                        );
                        return;
                    }

                    // Khóa/mở khóa tài khoản 1 thành viên -> cập nhật SIDEBAR realtime
                    // (mask/bỏ mask tên + avatar) qua DeviceEventEmitter.
                    const lockPayload = payload as {
                        domainEventType?: string;
                        conversationId?: unknown;
                        userId?: unknown;
                        accountLocked?: unknown;
                    };
                    const lockConversationId = toFiniteNumber(
                        lockPayload.conversationId,
                    );
                    if (
                        lockPayload.domainEventType ===
                            "MEMBER_ACCOUNT_LOCK_CHANGED" &&
                        lockConversationId !== null
                    ) {
                        DeviceEventEmitter.emit(
                            "conversation-member-lock-changed",
                            {
                                conversationId: lockConversationId,
                                userId: toFiniteNumber(lockPayload.userId),
                                accountLocked: Boolean(lockPayload.accountLocked),
                            },
                        );
                        return;
                    }

                    const directBlockPayload = payload as {
                        domainEventType?: string;
                        conversationId?: unknown;
                        blockerId?: unknown;
                        blockedId?: unknown;
                        blocked?: unknown;
                    };
                    const directBlockConversationId = toFiniteNumber(
                        directBlockPayload.conversationId,
                    );
                    if (
                        directBlockPayload.domainEventType ===
                            "DIRECT_BLOCK_STATUS_CHANGED" &&
                        directBlockConversationId !== null
                    ) {
                        DeviceEventEmitter.emit(
                            "conversation-direct-block-status-changed",
                            {
                                conversationId: directBlockConversationId,
                                blockerId: toFiniteNumber(directBlockPayload.blockerId),
                                blockedId: toFiniteNumber(directBlockPayload.blockedId),
                                blocked: Boolean(directBlockPayload.blocked),
                            },
                        );
                        return;
                    }

                    if (listeners.length === 0) return;

                    const createdConversation = (
                        payload as { conversationResponse?: Conversation }
                    ).conversationResponse;

                    if (createdConversation?.id) {
                        const lastMessageData =
                            toLastMessageUpdate(createdConversation);
                        if (
                            String(createdConversation.type).toUpperCase() ===
                                "DIRECT" &&
                            !lastMessageData
                        ) {
                            return;
                        }
                        const resolvedLastMessage =
                            lastMessageData ??
                            buildFallbackLastMessageUpdate(createdConversation);
                        const conversationSnapshot: ConversationSnapshot = {
                            ...createdConversation,
                            lastMessage:
                                createdConversation.lastMessage ??
                                resolvedLastMessage,
                        };

                        listeners.forEach((listener) =>
                            listener.onConversationUpdated(
                                createdConversation.id,
                                resolvedLastMessage,
                                conversationSnapshot,
                            ),
                        );
                        return;
                    }

                    const disbandPayload = payload as GroupDisbandedEvent;
                    const disbandConversationId = toFiniteNumber(
                        disbandPayload.conversationId,
                    );
                    if (
                        disbandPayload.domainEventType === "GROUP_DISBANDED" &&
                        disbandConversationId !== null
                    ) {
                        const conversationId = disbandConversationId;
                        // Gọi callback chuyên biệt nếu có (dùng trong useChatWindowController)
                        listeners.forEach((listener) =>
                            listener.onDisbanded?.(conversationId),
                        );

                        // Vẫn gọi onConversationUpdated để cập nhật sidebar list
                        listeners.forEach((listener) =>
                            listener.onConversationUpdated(
                                conversationId,
                                buildSystemFallbackByDomainEvent(
                                    disbandPayload.domainEventType,
                                ),
                            ),
                        );
                        return;
                    }

                    const joinRequestPayload = payload as NewJoinRequestEvent;
                    const joinRequestConversationId = toFiniteNumber(
                        joinRequestPayload.conversationId,
                    );
                    if (
                        joinRequestPayload.domainEventType === "NEW_JOIN_REQUEST" &&
                        joinRequestConversationId !== null &&
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
                        listeners.forEach((listener) =>
                            listener.onConversationUpdated(
                                joinRequestConversationId,
                                {
                                    lastMessageContent: requestSnapshotContent,
                                    lastMessageType: "SYSTEM_REQUIRE_APPROVAL",
                                    lastSenderId: request.inviterId ?? 0,
                                    lastSenderName: request.inviterName ?? "",
                                    lastMessageAt:
                                        request.createdAt ||
                                        new Date().toISOString(),
                                    read: false,
                                },
                                {
                                    id: joinRequestConversationId,
                                    type: "GROUP",
                                    updatedAt:
                                        request.createdAt ||
                                        new Date().toISOString(),
                                    pendingRequests: [request],
                                } as ConversationSnapshot,
                            ),
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
                        listeners.forEach((listener) =>
                            listener.onConversationUpdated(
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
                            ),
                        );
                        return;
                    }

                    const updatedEvent = payload as ConversationUpdatedEvent & {
                        conversationId?: unknown;
                        lastMessageResponse?: LastMessage;
                        lastMessageRespone?: LastMessage;
                    };
                    const updatedConversationId = toFiniteNumber(
                        updatedEvent.conversationId,
                    );
                    const updatedLastMessage =
                        updatedEvent.lastMessage ??
                        updatedEvent.lastMessageResponse ??
                        updatedEvent.lastMessageRespone;
                    if (updatedConversationId !== null && updatedLastMessage) {
                        listeners.forEach((listener) =>
                            listener.onConversationUpdated(
                                updatedConversationId,
                                updatedLastMessage,
                            ),
                        );
                    }
                } catch {
                    // no-op
                }
            });
        });
    }

     subscribeToTopic(
        destination: string,
        onMessage: (body: string) => void,
    ): void {
        const listeners =
            this.topicListeners.get(destination) ?? new Set<(body: string) => void>();
        listeners.add(onMessage);
        this.topicListeners.set(destination, listeners);

        if (this.subscriptions.has(destination)) {
            return;
        }

        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) throw new Error("WebSocket not connected");
            return client.subscribe(destination, (msg: IMessage) => {
                this.topicListeners
                    .get(destination)
                    ?.forEach((listener) => listener(msg.body));
            });
        });
    }

    unsubscribeFromTopic(destination: string, onMessage?: (body: string) => void): void {
        if (onMessage) {
            const listeners = this.topicListeners.get(destination);
            listeners?.delete(onMessage);
            if (listeners && listeners.size > 0) {
                return;
            }
        }
        this.topicListeners.delete(destination);
        this.removeSubscription(destination);
    }


    /**
     * Subscribe to GROUP_DISBANDED events for a specific conversation.
     * Uses a unique internal key so it doesn't overwrite the generic
     * subscribeToUserConversations subscription used by the sidebar.
     */
    subscribeToGroupDisbanded(
        userId: number,
        conversationId: number,
        onDisbanded: () => void,
    ): void {
        const destination = `/topic/user/${userId}/conversations`;
        const key = `${destination}::disband-watch::${conversationId}`;

        this.subscriptionFactories.set(key, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            // Không subscribe STOMP mới — chỉ forward từ topic gốc.
            // Thay vào đó ta tạo một subscriber độc lập lên cùng topic.
            return client.subscribe(destination, (message: IMessage) => {
                try {
                    const payload = JSON.parse(message.body) as {
                        domainEventType?: string;
                        conversationId?: number;
                    };
                    const disbandCid =
                        payload.domainEventType === "GROUP_DISBANDED"
                            ? payload.conversationId
                            : undefined;
                    if (disbandCid === conversationId) {
                        onDisbanded();
                    }
                } catch {
                    // no-op
                }
            });
        });

        // Kích hoạt ngay nếu đã kết nối
        if (this.client?.connected && !this.subscriptions.has(key)) {
            try {
                const sub = this.subscriptionFactories.get(key)!();
                this.subscriptions.set(key, sub);
            } catch {
                // retry sẽ được thực hiện ở syncSubscriptions()
            }
        }
    }

    unsubscribeFromGroupDisbanded(
        userId: number,
        conversationId: number,
    ): void {
        const destination = `/topic/user/${userId}/conversations`;
        const key = `${destination}::disband-watch::${conversationId}`;
        this.removeSubscription(key);
    }


    unsubscribeFromUserConversations(
        userId: number,
        onConversationUpdated?: UserConversationUpdateHandler,
    ): void {
        const destination = `/topic/user/${userId}/conversations`;
        const listeners = this.userConversationListeners.get(userId);

        if (listeners && onConversationUpdated) {
            listeners.delete(onConversationUpdated);
            if (listeners.size === 0) {
                this.userConversationListeners.delete(userId);
                this.removeSubscription(destination);
            }
            return;
        }

        this.userConversationListeners.delete(userId);
        this.removeSubscription(destination);
    }

    subscribeToCallEvents(
        userId: number,
        callback: (event: CallSignalPayload) => void,
    ): void {
        const existingListeners = this.callEventListeners.get(userId);
        if (existingListeners) {
            existingListeners.add(callback);
        } else {
            this.callEventListeners.set(userId, new Set([callback]));
        }

        const destination = `/topic/user/${userId}/calls`;
        if (this.subscriptions.has(destination)) {
            return;
        }

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
                    const payload = JSON.parse(message.body) as CallSignalPayload;
                    const listeners = this.callEventListeners.get(userId);
                    listeners?.forEach((listener) => listener(payload));
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromCallEvents(
        userId: number,
        callback?: (event: CallSignalPayload) => void,
    ): void {
        const listeners = this.callEventListeners.get(userId);

        if (callback && listeners) {
            listeners.delete(callback);
            if (listeners.size > 0) {
                return;
            }
        }

        if (!callback || !listeners || listeners.size === 0) {
            this.callEventListeners.delete(userId);
        }

        const destination = `/topic/user/${userId}/calls`;
        this.removeSubscription(destination);
    }

    sendCallSignal(payload: CallSignalPayload): void {
        if (!this.client?.connected) {
            console.log(`${WS_DEBUG_PREFIX} sendCallSignal skipped: disconnected`);
            return;
        }

        this.client.publish({
            destination: "/app/call.signal",
            body: JSON.stringify(payload),
        });
    }

    sendTypingSignal(
        conversationId: number,
        userId: number,
        isTyping: boolean,
    ): void {
        if (!this.client?.connected) return;

        this.client.publish({
            destination: `/app/chat/${conversationId}/typing`,
            body: JSON.stringify({ userId, isTyping }),
        });
    }

    subscribeToProfileUpdates(
        phone: string,
        onProfileUpdated: (payload: Record<string, unknown>) => void,
    ): void {
        const destination = `/topic/user/${phone}/profile-update`;
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (msg: IMessage) => {
                try {
                    const raw = JSON.parse(msg.body) as Record<string, unknown>;
                    onProfileUpdated(raw);
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromProfileUpdates(phone: string): void {
        this.removeSubscription(`/topic/user/${phone}/profile-update`);
    }

    subscribeToForceLogout(phone: string, onForceLogout: () => void): void {
        const destination = `/topic/user/${phone}/force-logout`;
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }
            return client.subscribe(destination, (msg: IMessage) => {
                try {
                    const raw = JSON.parse(msg.body) as Record<string, unknown>;
                    if (raw.event === "FORCE_LOGOUT") {
                        onForceLogout();
                    }
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromForceLogout(phone: string): void {
        this.removeSubscription(`/topic/user/${phone}/force-logout`);
    }

    // Force-logout theo NỀN TẢNG: chỉ bị đá khi có phiên MOBILE khác đăng nhập.
    // Tách khỏi topic chung (admin khóa / logout-all / đổi mật khẩu) vốn đá mọi nền tảng.
    subscribeToForceLogoutByPlatform(userId: number | string, platform: string, onForceLogout: () => void): void {
        const destination = `/topic/user/${userId}/force-logout/${platform}`;
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }
            return client.subscribe(destination, (msg: IMessage) => {
                try {
                    const raw = JSON.parse(msg.body) as Record<string, unknown>;
                    if (raw.event === "FORCE_LOGOUT") {
                        onForceLogout();
                    }
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromForceLogoutByPlatform(userId: number | string, platform: string): void {
        this.removeSubscription(`/topic/user/${userId}/force-logout/${platform}`);
    }
}

const chatWebsocketService = new ChatWebsocketService();

export default chatWebsocketService;
