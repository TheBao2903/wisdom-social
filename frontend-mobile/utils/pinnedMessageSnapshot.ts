import type { ConversationMember, PinnedMessageDetail } from "@/types/chat";
import type { PinnedBannerItem } from "@/utils/messageUtils";

type MemberLookup = Record<
    number,
    Pick<ConversationMember, "nickname" | "username">
>;

function resolvePinnedPreview(
    type?: PinnedMessageDetail["type"],
    content?: string,
): string {
    const normalized = (content ?? "").trim();

    if (type === "IMAGE") return "[Hinh anh]";
    if (type === "VIDEO") return "[Video]";
    if (type === "AUDIO") return "[Tin nhan thoai]";
    if (type === "FILE") return "[Tep dinh kem]";
    if (type === "CALL") return "[Cuoc goi]";

    return normalized || "Tin nhan da ghim";
}

export function buildPinnedBannerItemsFromSnapshot(args: {
    pins: PinnedMessageDetail[];
    membersById: MemberLookup;
}): PinnedBannerItem[] {
    const { pins, membersById } = args;

    return pins.slice(0, 3).map((pin) => {
        const senderId =
            typeof pin.originalSenderId === "number"
                ? pin.originalSenderId
                : pin.pinnerId;
        const sender = membersById[senderId];
        const normalizedContent = (pin.content ?? "").trim();

        return {
            messageId: pin.messageId,
            pinnedAt: pin.pinnedAt,
            senderName: sender?.nickname || sender?.username || "Nguoi dung",
            preview: resolvePinnedPreview(pin.type, pin.content),
            thumbUrl:
                pin.type === "IMAGE" && normalizedContent
                    ? normalizedContent
                    : undefined,
        };
    });
}
