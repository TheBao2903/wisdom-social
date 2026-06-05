import type { Message } from "../services/chatService";

export function isMessageDeletedForUser(
    message: Message | null | undefined,
    userId: number,
): boolean {
    if (!message || !Array.isArray(message.deletedFor)) {
        return false;
    }

    return message.deletedFor.includes(userId);
}
