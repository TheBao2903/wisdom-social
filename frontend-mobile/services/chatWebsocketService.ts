import { Client, type IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type {
    ConversationUpdatedEvent,
    MemberUpdatedEvent,
    Message,
    MessageCreatedEvent,
    MessageRecalledEvent,
    MessageSeenEvent,
    PinUpdatedEvent,
    TypingEvent,
} from "@/types/chat";
import apiClient from "@/api/apiClient";

type ConversationEvent =
    | MessageCreatedEvent
    | MessageRecalledEvent
    | MessageSeenEvent
    | TypingEvent;

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

const WS_DEBUG_PREFIX = "[RECALL_DEBUG][mobile][chatWebsocketService]";

class ChatWebsocketService {
    private client: Client | null = null;
    private subscriptions = new Map<string, { unsubscribe: () => void }>();
    private subscriptionFactories = new Map<
        string,
        () => { unsubscribe: () => void }
    >();
    private connectPromise: Promise<void> | null = null;

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
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions.clear();
        this.subscriptionFactories.clear();

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
    ): void {
        const destination = `/topic/conversations/${conversationId}/members`;
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (message: IMessage) => {
                try {
                    onMemberUpdated(
                        JSON.parse(message.body) as MemberUpdatedEvent,
                    );
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

    subscribeToUserConversations(
        userId: number,
        onConversationUpdated: (
            conversationId: number,
            lastMessage: ConversationUpdatedEvent["lastMessage"],
        ) => void,
    ): void {
        const destination = `/topic/user/${userId}/conversations`;
        this.registerSubscription(destination, () => {
            const client = this.client;
            if (!client?.connected) {
                throw new Error("WebSocket not connected");
            }

            return client.subscribe(destination, (message: IMessage) => {
                try {
                    const raw = JSON.parse(message.body) as
                        | ConversationUpdatedEvent
                        | {
                              payload?: ConversationUpdatedEvent;
                              data?: ConversationUpdatedEvent;
                              conversationId?: unknown;
                              lastMessage?: unknown;
                              lastMessageResponse?: unknown;
                          };
                    const container =
                        (raw as { payload?: ConversationUpdatedEvent })
                            .payload ??
                        (raw as { data?: ConversationUpdatedEvent }).data ??
                        raw;

                    const conversationIdRaw = (
                        container as { conversationId?: unknown }
                    ).conversationId;
                    const parsedConversationId = Number(conversationIdRaw);
                    if (!Number.isFinite(parsedConversationId)) {
                        return;
                    }

                    const lastMessageRaw =
                        (
                            container as {
                                lastMessage?: ConversationUpdatedEvent["lastMessage"];
                            }
                        ).lastMessage ??
                        (
                            container as {
                                lastMessageResponse?: ConversationUpdatedEvent["lastMessage"];
                            }
                        ).lastMessageResponse;

                    if (!lastMessageRaw) {
                        return;
                    }

                    onConversationUpdated(parsedConversationId, lastMessageRaw);
                } catch {
                    // no-op
                }
            });
        });
    }

    unsubscribeFromUserConversations(userId: number): void {
        const destination = `/topic/user/${userId}/conversations`;
        this.removeSubscription(destination);
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
}

const chatWebsocketService = new ChatWebsocketService();

export default chatWebsocketService;
