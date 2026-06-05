import type { Conversation, ConversationMember } from "../services/chatService";
import {
    LOCKED_ACCOUNT_AVATAR_URL,
    LOCKED_ACCOUNT_NAME,
} from "./lockedAccount";

interface MemberLike {
    userId: number;
    nickname?: string;
    username?: string;
    avatar?: string;
    status?: ConversationMember["status"];
    accountLocked?: boolean;
}

export interface ConversationDisplayInfo {
    name: string;
    avatarUrl: string | null;
    compositeAvatarUrls: string[];
}

interface BuildConversationDisplayInfoParams {
    conversation: Conversation;
    currentUserId: number;
    members?: MemberLike[];
}

const GROUP_NAME_FALLBACK = "Group Chat";
const DIRECT_NAME_FALLBACK = "Unknown";
const MAX_COMPOSITE_AVATARS = 4;

function isActiveMember(member: MemberLike): boolean {
    return !member.status || member.status === "ACTIVE";
}

function normalizeMembers(
    conversation: Conversation,
    members?: MemberLike[],
): MemberLike[] {
    const fromParams = Array.isArray(members)
        ? members.filter((member) => Number.isFinite(member.userId))
        : [];

    if (fromParams.length > 0) {
        return fromParams;
    }

    return (conversation.members ?? [])
        .filter((member) => Number.isFinite(member.userId))
        .map((member) => ({
            userId: member.userId,
            nickname: member.nickname,
            username: member.username,
            avatar: member.avatar,
            status: member.status,
            accountLocked: member.accountLocked,
        }));
}

function resolveMemberDisplayName(member: MemberLike): string {
    // Tài khoản bị khóa -> che tên thật.
    if (member.accountLocked) return LOCKED_ACCOUNT_NAME;

    const nickname = member.nickname?.trim();
    if (nickname) return nickname;

    const username = member.username?.trim();
    if (username) return username;

    return `Người dùng ${member.userId}`;
}

function buildGroupDisplayName(members: MemberLike[]): string {
    const activeMembers = members.filter(isActiveMember);
    const names: string[] = [];
    const seen = new Set<string>();

    for (const member of activeMembers) {
        const label = resolveMemberDisplayName(member);
        if (!label || seen.has(label)) continue;
        seen.add(label);
        names.push(label);
    }

    if (names.length === 0) return GROUP_NAME_FALLBACK;
    return names.join(", ");
}

function buildGroupCompositeAvatars(members: MemberLike[]): string[] {
    const activeMembers = members.filter(isActiveMember);
    const avatars: string[] = [];
    const seen = new Set<string>();

    for (const member of activeMembers) {
        // Tài khoản bị khóa -> dùng avatar trắng/mặc định thay cho avatar thật.
        const avatar = member.accountLocked
            ? LOCKED_ACCOUNT_AVATAR_URL
            : member.avatar?.trim();
        if (!avatar || seen.has(avatar)) continue;
        seen.add(avatar);
        avatars.push(avatar);
        if (avatars.length >= MAX_COMPOSITE_AVATARS) break;
    }

    return avatars;
}

export function buildConversationDisplayInfo({
    conversation,
    currentUserId,
    members,
}: BuildConversationDisplayInfoParams): ConversationDisplayInfo {
    const normalizedMembers = normalizeMembers(conversation, members);

    if (conversation.type === "GROUP") {
        const explicitGroupName = conversation.name?.trim();
        const name = explicitGroupName || buildGroupDisplayName(normalizedMembers);

        const explicitAvatarUrl = conversation.imageUrl?.trim() || null;
        const compositeAvatarUrls = explicitAvatarUrl
            ? []
            : buildGroupCompositeAvatars(normalizedMembers);

        return {
            name,
            avatarUrl: explicitAvatarUrl,
            compositeAvatarUrls,
        };
    }

    const otherMember = normalizedMembers.find(
        (member) => member.userId !== currentUserId,
    );
    const explicitDirectName = conversation.name?.trim();
    const explicitDirectAvatarUrl = conversation.imageUrl?.trim();

    // Đối phương bị khóa khi BẤT KỲ nguồn nào báo khóa:
    // - member.accountLocked (chi tiết hội thoại / realtime), hoặc
    // - conversation.directPartnerLocked (sidebar không có sẵn members,
    //   hoặc khi cache members cũ trả về false nhưng detail/DB là true).
    // Dùng OR thay vì ?? để cờ "đã khóa" luôn thắng dữ liệu cũ.
    const partnerLocked =
        Boolean(otherMember?.accountLocked) ||
        Boolean(conversation.directPartnerLocked);

    if (partnerLocked) {
        return {
            name: LOCKED_ACCOUNT_NAME,
            avatarUrl: LOCKED_ACCOUNT_AVATAR_URL,
            compositeAvatarUrls: [],
        };
    }

    return {
        name: otherMember
            ? resolveMemberDisplayName(otherMember)
            : explicitDirectName || DIRECT_NAME_FALLBACK,
        avatarUrl: otherMember?.avatar?.trim() || explicitDirectAvatarUrl || null,
        compositeAvatarUrls: [],
    };
}
