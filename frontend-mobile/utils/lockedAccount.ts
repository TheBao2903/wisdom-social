/**
 * Helper dùng chung để "mask" (che) thông tin hiển thị của tài khoản bị khóa
 * trong module chat/conversation (mobile).
 *
 * Quy tắc:
 * - Khi tài khoản bị khóa (accountLocked === true):
 *   + Tên hiển thị => "Tài khoản đã bị khóa"
 *   + Avatar => avatar mặc định/trắng (UserAvatar nhận prop `locked`)
 * - Khi KHÔNG bị khóa => giữ nguyên tên/avatar thật.
 *
 * Lưu ý: chỉ che ở tầng hiển thị, KHÔNG đổi nickname/avatar thật.
 * "accountLocked" khác hoàn toàn với ConversationMemberStatus.
 *
 * Trên RN không dùng được data-URI SVG cho <Image>, nên avatar khóa được render
 * bằng prop `locked` của <UserAvatar /> (icon người xám trên nền sáng).
 */

export const LOCKED_ACCOUNT_NAME = "Tài khoản đã bị khóa";

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
