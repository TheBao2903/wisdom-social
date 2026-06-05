interface MemberLookup {
    nickname?: string;
    username?: string;
}

export type GroupSystemMessageType =
    | "SYSTEM_CREATE_GROUP"
    | "SYSTEM_ADD_MEMBER"
    | "SYSTEM_UPDATE_ROLE"
    | "SYSTEM_KICK_MEMBER"
    | "SYSTEM_BLOCK_MEMBER"
    | "SYSTEM_LEAVE_GROUP"
    | "SYSTEM_DISBAND_GROUP"
    | "SYSTEM_UPDATE_SETTING"
    | "SYSTEM_REQUIRE_APPROVAL"
    | "SYSTEM_JOIN_VIA_LINK"
    | "SYSTEM_MEMBER_BLOCKED_FROM_JOIN"
    | "SYSTEM_GROUP_INVITE_LINK_SENT";

function formatCommaNameList(names: string[]): string {
    return names.join(", ");
}

interface MemberSnapshot {
    id?: number;
    name?: string;
}

function safeParseMemberEntries(content: string): MemberSnapshot[] {
    if (!content?.trim()) return [];

    try {
        const parsed = JSON.parse(content) as unknown;
        if (Array.isArray(parsed)) {
            return parsed
                .map((value) => {
                    if (typeof value === "number") {
                        return Number.isFinite(value) ? { id: value } : null;
                    }

                    if (typeof value === "string") {
                        const numericValue = Number(value);
                        if (Number.isFinite(numericValue)) {
                            return { id: numericValue };
                        }

                        return { name: value };
                    }

                    if (value && typeof value === "object") {
                        const record = value as Record<string, unknown>;
                        const numericId = Number(record.id);
                        const rawName =
                            typeof record.name === "string"
                                ? record.name
                                : typeof record.nickname === "string"
                                  ? record.nickname
                                  : typeof record.username === "string"
                                    ? record.username
                                    : undefined;

                        return {
                            id: Number.isFinite(numericId)
                                ? numericId
                                : undefined,
                            name: rawName,
                        };
                    }

                    return null;
                })
                .filter((value): value is MemberSnapshot => Boolean(value));
        }
    } catch {
        // Fallback parse bang regex ben duoi.
    }

    const extracted = content.match(/\d+/g) ?? [];
    return extracted
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((id) => ({ id }));
}

function safeParseRolePayload(content: string): {
    targetId?: number;
    targetName?: string;
    newRole?: string;
} {
    if (!content?.trim()) return {};

    try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const targetId = Number(parsed.targetId);
        const targetName =
            typeof parsed.targetName === "string"
                ? parsed.targetName
                : typeof parsed.name === "string"
                  ? parsed.name
                  : undefined;
        const newRole =
            typeof parsed.newRole === "string" ? parsed.newRole : undefined;

        return {
            targetId: Number.isFinite(targetId) ? targetId : undefined,
            targetName,
            newRole,
        };
    } catch {
        return {};
    }
}

function formatRoleLabel(role?: string): string {
    if (role === "OWNER") return "Trưởng nhóm";
    if (role === "DEPUTY") return "Phó nhóm";
    if (role === "MEMBER") return "Thành viên";
    return "vai trò mới";
}

function resolveMemberLabel(
    memberId: number,
    membersById: Record<number, MemberLookup>,
): string {
    const member = membersById[memberId];
    const nickname = member?.nickname?.trim();
    if (nickname) return nickname;

    const username = member?.username?.trim();
    if (username) return username;

    return "Người dùng";
}

function isUnknownLabel(label?: string): boolean {
    const normalized = label?.trim().toLowerCase();
    return (
        !normalized ||
        normalized === "unknown" ||
        normalized === "nguoi dung" ||
        normalized === "ngÆ°á»i dÃ¹ng"
    );
}

function resolveMemberLabelFromSnapshot(
    snapshot: MemberSnapshot,
    membersById: Record<number, MemberLookup>,
): string | null {
    const rawName = snapshot.name?.trim();
    if (rawName && rawName !== "Người dùng") {
        return rawName;
    }

    if (typeof snapshot.id === "number" && Number.isFinite(snapshot.id)) {
        const label = resolveMemberLabel(snapshot.id, membersById);
        return label === "Người dùng" ? null : label;
    }

    return null;
}

function resolveMemberUsername(
    memberId: number,
    membersById: Record<number, MemberLookup>,
): string | null {
    const member = membersById[memberId];
    const username = member?.username?.trim();
    return username || null;
}

function resolveActorLabel(params: {
    senderName: string;
    senderId?: number;
    membersById: Record<number, MemberLookup>;
}): string {
    const { senderName, senderId, membersById } = params;
    const normalizedSenderName = senderName?.trim();
    if (!isUnknownLabel(normalizedSenderName)) return normalizedSenderName;

    if (typeof senderId === "number" && Number.isFinite(senderId)) {
        return resolveMemberLabel(senderId, membersById);
    }

    return "Người dùng";
}

function buildSystemAddMembersMessage(params: {
    content: string;
    isOwn: boolean;
    actorLabel: string;
    currentUserId: number;
    membersById: Record<number, MemberLookup>;
}): string {
    const { content, isOwn, actorLabel, currentUserId, membersById } = params;

    const memberEntries = safeParseMemberEntries(content);
    const memberIds = Array.from(
        new Set(
            memberEntries
                .map((entry) => entry.id)
                .filter((value): value is number => typeof value === "number"),
        ),
    );

    if (isOwn) {
        const memberNames = memberEntries
            .map((entry) => resolveMemberLabelFromSnapshot(entry, membersById))
            .filter((name): name is string => Boolean(name));
        const joinedNames = formatCommaNameList(memberNames);
        if (!joinedNames) return "Bạn đã thêm thành viên vào nhóm";
        return `Bạn đã thêm ${joinedNames} vào nhóm`;
    }

    const hasCurrentUser = memberIds.includes(currentUserId);
    const otherEntries = memberEntries.filter(
        (entry) => entry.id !== currentUserId,
    );
    const otherNames = otherEntries
        .map((entry) => resolveMemberLabelFromSnapshot(entry, membersById))
        .filter((name): name is string => Boolean(name));
    const joinedOtherNames = formatCommaNameList(otherNames);

    if (hasCurrentUser && joinedOtherNames) {
        return `${actorLabel} đã thêm bạn, ${joinedOtherNames} vào nhóm`;
    }

    if (hasCurrentUser) {
        return `${actorLabel} đã thêm bạn vào nhóm`;
    }

    if (joinedOtherNames) {
        return `${actorLabel} đã thêm ${joinedOtherNames} vào nhóm`;
    }

    return `${actorLabel} đã cập nhật thành viên nhóm`;
}

function buildSystemRoleUpdateMessage(params: {
    content: string;
    isOwn: boolean;
    actorLabel: string;
    currentUserId: number;
    membersById: Record<number, MemberLookup>;
}): string {
    const { content, isOwn, actorLabel, currentUserId, membersById } = params;
    const payload = safeParseRolePayload(content);

    const targetLabel =
        typeof payload.targetId === "number"
            ? payload.targetId === currentUserId
                ? "bạn"
                : payload.targetName?.trim() ||
                  resolveMemberLabel(payload.targetId, membersById)
            : "một thành viên";
    const roleLabel = formatRoleLabel(payload.newRole);

    if (isOwn) {
        return `Bạn đã cập nhật ${targetLabel} thành ${roleLabel}`;
    }

    return `${actorLabel} đã cập nhật ${targetLabel} thành ${roleLabel}`;
}

function buildSystemKickMemberMessage(params: {
    content: string;
    isOwn: boolean;
    actorLabel: string;
    currentUserId: number;
    membersById: Record<number, MemberLookup>;
}): string {
    const { content, isOwn, actorLabel, currentUserId, membersById } = params;
    const targetEntry = safeParseMemberEntries(content)[0];
    const targetId = targetEntry?.id;
    const targetName = targetEntry?.name?.trim();

    if (typeof targetId !== "number") {
        return isOwn
            ? "Bạn đã xóa một thành viên khỏi nhóm"
            : `${actorLabel} đã xóa một thành viên khỏi nhóm`;
    }

    const targetLabel =
        targetId === currentUserId
            ? "bạn"
            : targetName && targetName !== "Người dùng"
              ? targetName
              : resolveMemberLabel(targetId, membersById);

    if (isOwn) {
        return `Bạn đã xóa ${targetLabel} khỏi nhóm`;
    }

    return `${actorLabel} đã xóa ${targetLabel} khỏi nhóm`;
}

function buildSystemBlockMemberMessage(params: {
    content: string;
    isOwn: boolean;
    actorLabel: string;
    currentUserId: number;
    membersById: Record<number, MemberLookup>;
}): string {
    const { content, isOwn, actorLabel, currentUserId, membersById } = params;
    const names = safeParseMemberEntries(content)
        .map((entry) => {
            if (entry.id === currentUserId) return "bạn";
            return resolveMemberLabelFromSnapshot(entry, membersById);
        })
        .filter((name): name is string => Boolean(name));
    const targetLabel = formatCommaNameList(names) || "thành viên này";
    return isOwn
        ? `Bạn đã chặn ${targetLabel} tham gia nhóm`
        : `${actorLabel} đã chặn ${targetLabel} tham gia nhóm`;
}

function buildBlockedFromJoinMessage(params: {
    content: string;
    membersById: Record<number, MemberLookup>;
}): string {
    const names = safeParseMemberEntries(params.content)
        .map((entry) => resolveMemberLabelFromSnapshot(entry, params.membersById))
        .filter((name): name is string => Boolean(name));
    const targetLabel = formatCommaNameList(names) || "Thành viên này";
    return `${targetLabel} đã bị trưởng/phó nhóm chặn tham gia nhóm`;
}

function buildSystemLeaveGroupMessage(params: {
    isOwn: boolean;
    actorLabel: string;
    senderId?: number;
    membersById: Record<number, MemberLookup>;
}): string {
    const { isOwn, actorLabel, senderId, membersById } = params;
    if (isOwn) return "Bạn đã rời khỏi nhóm";

    if (typeof senderId === "number" && Number.isFinite(senderId)) {
        const username = resolveMemberUsername(senderId, membersById);
        if (username) {
            return `${username} đã rời khỏi nhóm`;
        }
    }

    if (actorLabel === "Người dùng") return "Một thành viên đã rời khỏi nhóm";
    return `${actorLabel} đã rời khỏi nhóm`;
}

function buildSystemDisbandGroupMessage(params: {
    isOwn: boolean;
    actorLabel: string;
}): string {
    const { isOwn, actorLabel } = params;
    if (isOwn) return "Bạn đã giải tán nhóm";
    if (actorLabel === "Người dùng") return "Nhóm đã được giải tán";
    return `${actorLabel} đã giải tán nhóm`;
}

function buildSystemUpdateSettingMessage(params: {
    content: string;
    isOwn: boolean;
    actorLabel: string;
}): string {
    const { content, isOwn, actorLabel } = params;
    const normalizedContent = content.trim();
    const isMessageRestrictionSetting =
        normalizedContent.includes("isMessageRestricted") ||
        normalizedContent.includes("chỉ Trưởng/Phó nhóm được gửi tin nhắn");

    if (!isMessageRestrictionSetting) {
        return isOwn
            ? `Bạn ${normalizedContent}`
            : `${actorLabel} ${normalizedContent}`;
    }

    const isRestricted =
        normalizedContent.includes("isMessageRestricted:true") ||
        normalizedContent.includes(
            "đã bật chế độ chỉ Trưởng/Phó nhóm được gửi tin nhắn",
        );

    if (isRestricted) {
        return isOwn
            ? "Bạn đã bật chế độ chỉ Trưởng/Phó nhóm được gửi tin nhắn"
            : `${actorLabel} đã bật chế độ chỉ Trưởng/Phó nhóm được gửi tin nhắn`;
    } else {
        return isOwn
            ? "Bạn đã tắt chế độ chỉ Trưởng/Phó nhóm được gửi tin nhắn"
            : `${actorLabel} đã tắt chế độ chỉ Trưởng/Phó nhóm được gửi tin nhắn`;
    }
}

export function buildSystemGroupMessage(params: {
    type: GroupSystemMessageType;
    content: string;
    isOwn: boolean;
    senderName: string;
    senderId?: number;
    currentUserId: number;
    membersById: Record<number, MemberLookup>;
}): string {
    const {
        type,
        content,
        isOwn,
        senderName,
        senderId,
        currentUserId,
        membersById,
    } = params;

    const actorLabel = resolveActorLabel({
        senderName,
        senderId,
        membersById,
    });

    if (type === "SYSTEM_CREATE_GROUP" || type === "SYSTEM_ADD_MEMBER") {
        return buildSystemAddMembersMessage({
            content,
            isOwn,
            actorLabel,
            currentUserId,
            membersById,
        });
    }

    if (type === "SYSTEM_UPDATE_ROLE") {
        return buildSystemRoleUpdateMessage({
            content,
            isOwn,
            actorLabel,
            currentUserId,
            membersById,
        });
    }

    if (type === "SYSTEM_KICK_MEMBER") {
        return buildSystemKickMemberMessage({
            content,
            isOwn,
            actorLabel,
            currentUserId,
            membersById,
        });
    }

    if (type === "SYSTEM_BLOCK_MEMBER") {
        return buildSystemBlockMemberMessage({
            content,
            isOwn,
            actorLabel,
            currentUserId,
            membersById,
        });
    }

    if (type === "SYSTEM_MEMBER_BLOCKED_FROM_JOIN") {
        return buildBlockedFromJoinMessage({
            content,
            membersById,
        });
    }

    if (type === "SYSTEM_GROUP_INVITE_LINK_SENT") {
        const memberNames = safeParseMemberEntries(content)
            .map((entry) => resolveMemberLabelFromSnapshot(entry, membersById))
            .filter((name): name is string => Boolean(name));
        const joinedNames = formatCommaNameList(memberNames) || "Nguoi duoc moi";
        return `${joinedNames} da nhan duoc link nhom va can xac nhan tham gia.`;
    }

    if (type === "SYSTEM_LEAVE_GROUP") {
        return buildSystemLeaveGroupMessage({
            isOwn,
            actorLabel,
            senderId,
            membersById,
        });
    }

    if (type === "SYSTEM_DISBAND_GROUP") {
        return buildSystemDisbandGroupMessage({
            isOwn,
            actorLabel,
        });
    }

    if (type === "SYSTEM_REQUIRE_APPROVAL") {
        const memberNames = safeParseMemberEntries(content)
            .map((entry) => resolveMemberLabelFromSnapshot(entry, membersById))
            .filter((name): name is string => Boolean(name));
        const joinedNames =
            formatCommaNameList(memberNames) || "Thành viên mới";
        const hasInviter =
            Boolean(senderName?.trim()) ||
            (typeof senderId === "number" &&
                Number.isFinite(senderId) &&
                senderId > 0);
        if (!hasInviter) {
            return `${joinedNames} yêu cầu tham gia nhóm và cần trưởng/phó nhóm phê duyệt.`;
        }
        const inviterLabel = isOwn ? "bạn" : actorLabel;
        return inviterLabel === "Người dùng"
            ? `${joinedNames} yêu cầu tham gia nhóm và cần trưởng/phó nhóm phê duyệt.`
            : `${joinedNames} được ${inviterLabel} mời tham gia nhóm và cần trưởng/phó nhóm phê duyệt.`;
    }

    if (type === "SYSTEM_JOIN_VIA_LINK") {
        return isOwn
            ? "Bạn đã tham gia nhóm bằng link"
            : `${actorLabel} đã tham gia nhóm bằng link`;
    }

    return buildSystemUpdateSettingMessage({
        content,
        isOwn,
        actorLabel,
    });
}

export function buildSystemCreateGroupMessage(params: {
    content: string;
    isOwn: boolean;
    senderName: string;
    senderId?: number;
    currentUserId: number;
    membersById: Record<number, MemberLookup>;
}): string {
    return buildSystemGroupMessage({
        type: "SYSTEM_CREATE_GROUP",
        content: params.content,
        isOwn: params.isOwn,
        senderName: params.senderName,
        senderId: params.senderId,
        currentUserId: params.currentUserId,
        membersById: params.membersById,
    });
}
