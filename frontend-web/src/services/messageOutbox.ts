import type { Message, SendMessageRequest } from "./chatService";

const DB_NAME = "wisdom-social-chat";
const DB_VERSION = 1;
const STORE_NAME = "messageOutbox";
const STALE_SENDING_RETRY_MS = 15_000;

export type OutboxStatus = "pending" | "sending" | "failed";

export interface OutboxMessage {
    clientMessageId: string;
    conversationId: number;
    userId: number;
    request: SendMessageRequest;
    preview: Message;
    mediaFiles?: Array<{
        file: File;
        fileName: string;
        mimeType: string;
        fileSize: number;
    }>;
    textContent?: string;
    replyToId?: string;
    status: OutboxStatus;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: "clientMessageId",
                });
                store.createIndex("conversationId", "conversationId", { unique: false });
                store.createIndex("status", "status", { unique: false });
                store.createIndex("createdAt", "createdAt", { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function runStore<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
    return openDb().then(
        (db) =>
            new Promise<T | void>((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, mode);
                const store = transaction.objectStore(STORE_NAME);
                const request = callback(store);

                transaction.oncomplete = () => {
                    db.close();
                    resolve(request ? request.result : undefined);
                };
                transaction.onerror = () => {
                    db.close();
                    reject(transaction.error);
                };
            }),
    );
}

export const messageOutbox = {
    async save(item: OutboxMessage): Promise<void> {
        await runStore("readwrite", (store) => store.put(item));
    },

    async remove(clientMessageId: string): Promise<void> {
        await runStore("readwrite", (store) => store.delete(clientMessageId));
    },

    async updateStatus(
        clientMessageId: string,
        status: OutboxStatus,
    ): Promise<void> {
        const existing = await this.get(clientMessageId);
        if (!existing) return;
        await this.save({
            ...existing,
            status,
            retryCount:
                status === "failed" ? existing.retryCount + 1 : existing.retryCount,
            updatedAt: new Date().toISOString(),
        });
    },

    async get(clientMessageId: string): Promise<OutboxMessage | undefined> {
        const result = await runStore<OutboxMessage | undefined>(
            "readonly",
            (store) => store.get(clientMessageId),
        );
        return result as OutboxMessage | undefined;
    },

    async listPending(): Promise<OutboxMessage[]> {
        const result = await runStore<OutboxMessage[]>("readonly", (store) =>
            store.getAll(),
        );
        const now = Date.now();
        return ((result as OutboxMessage[] | undefined) ?? [])
            .filter(
                (item) => {
                    if (item.status === "pending" || item.status === "failed") {
                        return true;
                    }
                    if (item.status !== "sending") {
                        return false;
                    }
                    const updatedAt = Date.parse(item.updatedAt);
                    return (
                        Number.isNaN(updatedAt) ||
                        now - updatedAt > STALE_SENDING_RETRY_MS
                    );
                },
            )
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async listByConversation(conversationId: number): Promise<OutboxMessage[]> {
        const result = await runStore<OutboxMessage[]>("readonly", (store) =>
            store.getAll(),
        );
        return ((result as OutboxMessage[] | undefined) ?? [])
            .filter((item) => item.conversationId === conversationId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
};

export function createClientMessageId(prefix = "web"): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
