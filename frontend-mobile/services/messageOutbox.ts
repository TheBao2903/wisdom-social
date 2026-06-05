import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import type { LocalUploadFile, Message, SendMessageRequest } from "@/types/chat";

const DB_NAME = "wisdom-social-chat.db";
const TABLE_NAME = "message_outbox";
const OUTBOX_MEDIA_DIR = `${FileSystem.documentDirectory ?? ""}chat-outbox`;

export type OutboxStatus = "pending" | "sending" | "failed";

export interface OutboxMessage {
    clientMessageId: string;
    conversationId: number;
    userId: number;
    request: SendMessageRequest;
    preview: Message;
    mediaFiles?: LocalUploadFile[];
    textContent?: string;
    replyToId?: string;
    status: OutboxStatus;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
}

interface OutboxRow {
    client_message_id: string;
    conversation_id: number;
    user_id: number;
    request_json: string;
    preview_json: string;
    media_files_json: string | null;
    text_content: string | null;
    reply_to_id: string | null;
    status: OutboxStatus;
    retry_count: number;
    created_at: string;
    updated_at: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDb(): Promise<SQLite.SQLiteDatabase> {
    if (!dbPromise) {
        dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                    client_message_id TEXT PRIMARY KEY NOT NULL,
                    conversation_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    request_json TEXT NOT NULL,
                    preview_json TEXT NOT NULL,
                    media_files_json TEXT,
                    text_content TEXT,
                    reply_to_id TEXT,
                    status TEXT NOT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_message_outbox_conversation
                    ON ${TABLE_NAME} (conversation_id);
                CREATE INDEX IF NOT EXISTS idx_message_outbox_status
                    ON ${TABLE_NAME} (status);
                CREATE INDEX IF NOT EXISTS idx_message_outbox_created_at
                    ON ${TABLE_NAME} (created_at);
            `);
            return db;
        });
    }

    return dbPromise;
}

function toRow(item: OutboxMessage): OutboxRow {
    return {
        client_message_id: item.clientMessageId,
        conversation_id: item.conversationId,
        user_id: item.userId,
        request_json: JSON.stringify(item.request),
        preview_json: JSON.stringify(item.preview),
        media_files_json: item.mediaFiles
            ? JSON.stringify(item.mediaFiles)
            : null,
        text_content: item.textContent ?? null,
        reply_to_id: item.replyToId ?? null,
        status: item.status,
        retry_count: item.retryCount,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
    };
}

function fromRow(row: OutboxRow): OutboxMessage {
    return {
        clientMessageId: row.client_message_id,
        conversationId: row.conversation_id,
        userId: row.user_id,
        request: JSON.parse(row.request_json) as SendMessageRequest,
        preview: JSON.parse(row.preview_json) as Message,
        mediaFiles: row.media_files_json
            ? (JSON.parse(row.media_files_json) as LocalUploadFile[])
            : undefined,
        textContent: row.text_content ?? undefined,
        replyToId: row.reply_to_id ?? undefined,
        status: row.status,
        retryCount: row.retry_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function deletePersistedMediaFiles(item: OutboxMessage): Promise<void> {
    const files = item.mediaFiles ?? [];
    await Promise.all(
        files.map(async (file) => {
            if (!file.uri.startsWith(OUTBOX_MEDIA_DIR)) return;
            await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(
                () => undefined,
            );
        }),
    );
}

export async function persistOutboxMediaFiles(
    files: LocalUploadFile[],
    clientMessageId: string,
): Promise<LocalUploadFile[]> {
    await FileSystem.makeDirectoryAsync(OUTBOX_MEDIA_DIR, {
        intermediates: true,
    });

    return Promise.all(
        files.map(async (file, index) => {
            const extension = file.fileName.includes(".")
                ? file.fileName.slice(file.fileName.lastIndexOf("."))
                : "";
            const destination = `${OUTBOX_MEDIA_DIR}/${clientMessageId}-${index}${extension}`;
            await FileSystem.copyAsync({
                from: file.uri,
                to: destination,
            });
            return {
                ...file,
                uri: destination,
            };
        }),
    );
}

export const messageOutbox = {
    async save(item: OutboxMessage): Promise<void> {
        const db = await openDb();
        const row = toRow(item);
        await db.runAsync(
            `INSERT OR REPLACE INTO ${TABLE_NAME} (
                client_message_id,
                conversation_id,
                user_id,
                request_json,
                preview_json,
                media_files_json,
                text_content,
                reply_to_id,
                status,
                retry_count,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row.client_message_id,
            row.conversation_id,
            row.user_id,
            row.request_json,
            row.preview_json,
            row.media_files_json,
            row.text_content,
            row.reply_to_id,
            row.status,
            row.retry_count,
            row.created_at,
            row.updated_at,
        );
    },

    async remove(clientMessageId: string): Promise<void> {
        const existing = await this.get(clientMessageId);
        const db = await openDb();
        await db.runAsync(
            `DELETE FROM ${TABLE_NAME} WHERE client_message_id = ?`,
            clientMessageId,
        );
        if (existing) {
            await deletePersistedMediaFiles(existing);
        }
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

    async get(clientMessageId: string): Promise<OutboxMessage | null> {
        const db = await openDb();
        const row = await db.getFirstAsync<OutboxRow>(
            `SELECT * FROM ${TABLE_NAME} WHERE client_message_id = ?`,
            clientMessageId,
        );
        return row ? fromRow(row) : null;
    },

    async listPending(): Promise<OutboxMessage[]> {
        const db = await openDb();
        const rows = await db.getAllAsync<OutboxRow>(
            `SELECT * FROM ${TABLE_NAME}
             WHERE status IN ('pending', 'sending', 'failed')
             ORDER BY created_at ASC`,
        );
        return rows.map(fromRow);
    },

    async listByConversation(conversationId: number): Promise<OutboxMessage[]> {
        const db = await openDb();
        const rows = await db.getAllAsync<OutboxRow>(
            `SELECT * FROM ${TABLE_NAME}
             WHERE conversation_id = ?
             ORDER BY created_at ASC`,
            conversationId,
        );
        return rows.map(fromRow);
    },
};

export function createClientMessageId(prefix = "mobile"): string {
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) {
        return `${prefix}-${randomUuid}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
