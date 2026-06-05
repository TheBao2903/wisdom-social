/**
 * Helper dùng chung để "mask" (che) thông tin hiển thị của tài khoản bị khóa
 * trong module chat/conversation.
 *
 * Quy tắc:
 * - Khi tài khoản bị khóa (accountLocked === true):
 *   + Tên hiển thị => "Tài khoản đã bị khóa"
 *   + Avatar => ảnh trắng/mặc định (không dùng avatar thật)
 * - Khi KHÔNG bị khóa => giữ nguyên tên/avatar thật.
 *
 * Lưu ý: đây CHỈ là che ở tầng hiển thị, KHÔNG thay đổi dữ liệu nickname/avatar thật.
 * "accountLocked" hoàn toàn khác với ConversationMemberStatus (ACTIVE/LEFT/KICKED/...).
 */

export const LOCKED_ACCOUNT_NAME = "Tài khoản đã bị khóa";

// Avatar trắng + bóng người xám nhạt (SVG data URI) để không lộ avatar thật.
const LOCKED_ACCOUNT_AVATAR_SVG =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="#ffffff"/>` +
    `<circle cx="50" cy="38" r="18" fill="#e5e7eb"/>` +
    `<path d="M18 88c0-17 14-28 32-28s32 11 32 28z" fill="#e5e7eb"/>` +
    `</svg>`;

export const LOCKED_ACCOUNT_AVATAR_URL = `data:image/svg+xml,${encodeURIComponent(
    LOCKED_ACCOUNT_AVATAR_SVG,
)}`;

/** Đối tượng tối thiểu có cờ khóa tài khoản. */
export interface AccountLockable {
    accountLocked?: boolean;
}

/** true nếu đối tượng đại diện cho 1 tài khoản đang bị khóa. */
export function isAccountLocked(target?: AccountLockable | null): boolean {
    return Boolean(target?.accountLocked);
}

/** Trả về tên hiển thị đã mask nếu bị khóa, ngược lại trả về tên thật. */
export function maskDisplayName(
    locked: boolean | undefined,
    realName: string,
): string {
    return locked ? LOCKED_ACCOUNT_NAME : realName;
}

/**
 * Trả về avatar đã mask (ảnh trắng/mặc định) nếu bị khóa,
 * ngược lại trả về avatar thật (hoặc null nếu không có).
 */
export function maskAvatarUrl(
    locked: boolean | undefined,
    realAvatar?: string | null,
): string | null {
    if (locked) return LOCKED_ACCOUNT_AVATAR_URL;
    return realAvatar ?? null;
}
