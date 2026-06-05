const pendingConversationRefreshIds = new Set<number>();

export function requestInviteReturnSync(conversationId: number): void {
    if (!Number.isFinite(conversationId)) return;
    pendingConversationRefreshIds.add(conversationId);
}

export function consumeInviteReturnSync(conversationId: number): boolean {
    if (!pendingConversationRefreshIds.has(conversationId)) return false;
    pendingConversationRefreshIds.delete(conversationId);
    return true;
}
