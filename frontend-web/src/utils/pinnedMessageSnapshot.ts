import type { MessageType, PinnedMessageDetail } from "../services/chatService";
import type { MembersByUserId } from "../stores/chatRuntimeStore";

export interface PinnedBannerItem {
    messageId: string;
    pinnedAt: string;
    senderName: string;
    preview: string;
    thumbUrl?: string;
}

function resolvePinnedPreview(type?: MessageType, content?: string): string {
    const normalized = (content ?? "").trim();

    if (type === "IMAGE") return "[Hình ảnh]";
    if (type === "VIDEO") return "[Video]";
    if (type === "AUDIO") return "[Tin nhắn thoại]";
    if (type === "FILE") return "[Tệp đính kèm]";
    if (type === "CALL") return "[Cuộc gọi]";

    return normalized || "Tin nhắn đã ghim";
}

export function buildPinnedBannerItemsFromSnapshot(args: {
    pins: PinnedMessageDetail[];
    membersById: MembersByUserId;
}): PinnedBannerItem[] {
    const { pins, membersById } = args;

    return pins.map((pin) => {
        const senderId =
            typeof pin.originalSenderId === "number"
                ? pin.originalSenderId
                : pin.pinnerId;
        const sender = membersById[senderId];
        const normalizedContent = (pin.content ?? "").trim();

        return {
            messageId: pin.messageId,
            pinnedAt: pin.pinnedAt,
            senderName: sender?.nickname || sender?.username || "Người dùng",
            preview: resolvePinnedPreview(pin.type, pin.content),
            thumbUrl:
                pin.type === "IMAGE" && normalizedContent
                    ? normalizedContent
                    : undefined,
        };
    });
}
