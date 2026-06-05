import axiosClient from '../api/axiosClient';
import type {
  AuditActorType,
  AuditCategory,
  AuditLog,
  AuditStatus,
} from '../types/models';

const STORAGE_KEY = 'admin_audit_logs';
const ACTOR_KEY = 'admin_audit_actor';
const MAX_ENTRIES = 2000;

/* ------------------------------------------------------------------ */
/* Actor (người thực hiện) hiện tại                                    */
/* ------------------------------------------------------------------ */

interface CurrentActor {
  id?: string | number;
  name: string;
}

export function setAuditActor(actor: { id?: string | number; name?: string } | null): void {
  try {
    if (!actor) {
      localStorage.removeItem(ACTOR_KEY);
      return;
    }
    localStorage.setItem(
      ACTOR_KEY,
      JSON.stringify({ id: actor.id, name: actor.name || 'Admin' })
    );
  } catch {
    /* localStorage không khả dụng */
  }
}

function getCurrentActor(): CurrentActor {
  try {
    const raw = localStorage.getItem(ACTOR_KEY);
    if (raw) return JSON.parse(raw) as CurrentActor;
  } catch {
    /* ignore */
  }
  return { name: 'Admin' };
}

/* ------------------------------------------------------------------ */
/* Lưu trữ cục bộ                                                      */
/* ------------------------------------------------------------------ */

function readAll(): AuditLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditLog[]) : [];
  } catch {
    return [];
  }
}

function writeAll(logs: AuditLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_ENTRIES)));
  } catch {
    /* vượt quota -> bỏ qua */
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Ghi một bản ghi nhật ký (mới nhất lên đầu). */
export function addLog(
  entry: Omit<AuditLog, 'id' | 'timestamp'> & { timestamp?: string }
): AuditLog {
  const log: AuditLog = {
    id: makeId(),
    timestamp: entry.timestamp || new Date().toISOString(),
    ...entry,
  };
  const all = readAll();
  all.unshift(log);
  writeAll(all);
  return log;
}

/* ------------------------------------------------------------------ */
/* Ánh xạ request -> hành động có ý nghĩa                              */
/* ------------------------------------------------------------------ */

interface ActionDescriptor {
  action: string;
  category: AuditCategory;
  /** label gốc, sẽ được bổ sung tên đối tượng khi build mô tả */
  label: string;
  targetType?: string;
  /** lấy id đối tượng từ path/body */
  targetId?: (path: string, body: any) => string | number | undefined;
}

const num = (v: string | undefined) => (v == null ? undefined : v);

/** Danh sách matcher theo method + regex path. */
const MATCHERS: Array<{
  method: string;
  re: RegExp;
  build: (m: RegExpMatchArray, body: any) => ActionDescriptor;
}> = [
  // --- AUTH ---
  {
    method: 'POST',
    re: /\/auth\/login$/,
    build: () => ({ action: 'LOGIN', category: 'AUTH', label: 'Đăng nhập quản trị' }),
  },
  {
    method: 'POST',
    re: /\/auth\/logout$/,
    build: () => ({ action: 'LOGOUT', category: 'AUTH', label: 'Đăng xuất khỏi hệ thống' }),
  },
  // --- USER ---
  {
    method: 'POST',
    re: /\/admin\/lock\/(\w+)/,
    build: (m) => ({
      action: 'LOCK_USER',
      category: 'USER',
      label: 'Khoá tài khoản người dùng',
      targetType: 'USER',
      targetId: () => num(m[1]),
    }),
  },
  {
    method: 'POST',
    re: /\/admin\/unlock\/(\w+)/,
    build: (m) => ({
      action: 'UNLOCK_USER',
      category: 'USER',
      label: 'Mở khoá tài khoản người dùng',
      targetType: 'USER',
      targetId: () => num(m[1]),
    }),
  },
  {
    method: 'DELETE',
    re: /\/auth\/users\/(\w+)/,
    build: (m) => ({
      action: 'DELETE_USER',
      category: 'USER',
      label: 'Xoá tài khoản người dùng',
      targetType: 'USER',
      targetId: () => num(m[1]),
    }),
  },
  {
    method: 'PUT',
    re: /\/auth\/users\/(\w+)/,
    build: (m) => ({
      action: 'UPDATE_USER',
      category: 'USER',
      label: 'Cập nhật thông tin người dùng',
      targetType: 'USER',
      targetId: () => num(m[1]),
    }),
  },
  // --- PAGE ---
  {
    method: 'DELETE',
    re: /\/page\/delete\/(\w+)/,
    build: (m) => ({
      action: 'DELETE_PAGE',
      category: 'PAGE',
      label: 'Xoá trang (Page)',
      targetType: 'PAGE',
      targetId: () => num(m[1]),
    }),
  },
  {
    method: 'POST',
    re: /\/page-member\/approve-join$/,
    build: (_m, b) => ({
      action: 'APPROVE_MEMBER',
      category: 'PAGE',
      label: 'Duyệt yêu cầu tham gia trang',
      targetType: 'PAGE',
      targetId: () => b?.pageId,
    }),
  },
  {
    method: 'POST',
    re: /\/page-member\/reject-join$/,
    build: (_m, b) => ({
      action: 'REJECT_MEMBER',
      category: 'PAGE',
      label: 'Từ chối yêu cầu tham gia trang',
      targetType: 'PAGE',
      targetId: () => b?.pageId,
    }),
  },
  {
    method: 'POST',
    re: /\/page-member\/block$/,
    build: (_m, b) => ({
      action: 'BLOCK_MEMBER',
      category: 'PAGE',
      label: 'Chặn thành viên trang',
      targetType: 'PAGE',
      targetId: () => b?.pageId,
    }),
  },
  {
    method: 'POST',
    re: /\/page-member\/cancel-block$/,
    build: (_m, b) => ({
      action: 'UNBLOCK_MEMBER',
      category: 'PAGE',
      label: 'Bỏ chặn thành viên trang',
      targetType: 'PAGE',
      targetId: () => b?.pageId,
    }),
  },
  {
    method: 'POST',
    re: /\/page-member\/delete$/,
    build: (_m, b) => ({
      action: 'REMOVE_MEMBER',
      category: 'PAGE',
      label: 'Xoá thành viên khỏi trang',
      targetType: 'PAGE',
      targetId: () => b?.pageId,
    }),
  },
  {
    method: 'POST',
    re: /\/page-member\/authorize$/,
    build: (_m, b) => ({
      action: 'AUTHORIZE_MEMBER',
      category: 'PAGE',
      label: 'Phân quyền thành viên trang',
      targetType: 'PAGE',
      targetId: () => b?.pageId,
    }),
  },
  {
    method: 'POST',
    re: /\/page\/post\/approve$/,
    build: (_m, b) => ({
      action: 'APPROVE_PAGE_POST',
      category: 'PAGE',
      label: 'Duyệt bài đăng trên trang',
      targetType: 'POST',
      targetId: () => b?.postId,
    }),
  },
  {
    method: 'POST',
    re: /\/page\/post\/remove$/,
    build: (_m, b) => ({
      action: 'REMOVE_PAGE_POST',
      category: 'PAGE',
      label: 'Gỡ bài đăng khỏi trang',
      targetType: 'POST',
      targetId: () => b?.postId,
    }),
  },
  // --- POST ---
  {
    method: 'DELETE',
    re: /\/posts\/([\w-]+)$/,
    build: (m) => ({
      action: 'DELETE_POST',
      category: 'POST',
      label: 'Xoá bài đăng',
      targetType: 'POST',
      targetId: () => m[1],
    }),
  },
  // --- STORY ---
  {
    method: 'DELETE',
    re: /\/admin\/stories\/([\w-]+)$/,
    build: (m) => ({
      action: 'DELETE_STORY',
      category: 'STORY',
      label: 'Xoá story',
      targetType: 'STORY',
      targetId: () => m[1],
    }),
  },
];

/** Các endpoint hệ thống không cần ghi log (nhiễu). */
const IGNORE_RE = [/\/auth\/refresh/, /\/auth\/me/, /upload/i, /presign/i, /generate-url/i];

export interface ActionInfo {
  action: string;
  category: AuditCategory;
  description: string;
  targetType?: string;
  targetId?: string | number;
}

/**
 * Suy ra hành động từ một request đã hoàn tất.
 * Trả về null nếu request không đáng ghi log.
 */
export function describeAction(
  method: string,
  url: string,
  body: any
): ActionInfo | null {
  const m = (method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return null;
  if (IGNORE_RE.some((re) => re.test(url))) return null;

  let parsedBody: any = body;
  if (typeof body === 'string') {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = body;
    }
  }

  for (const matcher of MATCHERS) {
    if (matcher.method !== m) continue;
    const match = url.match(matcher.re);
    if (!match) continue;
    const d = matcher.build(match, parsedBody);
    const targetId = d.targetId ? d.targetId(url, parsedBody) : undefined;
    return {
      action: d.action,
      category: d.category,
      description: d.label,
      targetType: d.targetType,
      targetId,
    };
  }

  // Hành động ghi (write) chưa được ánh xạ -> log chung để không bỏ sót
  const path = url.split('?')[0];
  return {
    action: `${m}_REQUEST`,
    category: 'SYSTEM',
    description: `${m} ${path}`,
  };
}

/* ------------------------------------------------------------------ */
/* Điểm vào cho interceptor                                            */
/* ------------------------------------------------------------------ */

export function recordRequestOutcome(opts: {
  method?: string;
  url?: string;
  body?: any;
  status: AuditStatus;
  statusCode?: number;
  errorMessage?: string;
}): void {
  if (!opts.url) return;
  const info = describeAction(opts.method || 'GET', opts.url, opts.body);
  if (!info) return;

  const actor = getCurrentActor();
  // Login thành công: lấy số điện thoại từ body làm actor
  let actorName = actor.name;
  let actorId = actor.id;
  if (info.action === 'LOGIN') {
    let b = opts.body;
    if (typeof b === 'string') {
      try {
        b = JSON.parse(b);
      } catch {
        /* ignore */
      }
    }
    if (b?.phone) actorName = b.phone;
  }

  addLog({
    actorType: 'ADMIN',
    actorId,
    actorName,
    action: info.action,
    description: info.description,
    category: info.category,
    targetType: info.targetType,
    targetId: info.targetId,
    method: (opts.method || 'GET').toUpperCase(),
    endpoint: opts.url.split('?')[0],
    status: opts.status,
    statusCode: opts.statusCode,
    meta: opts.errorMessage ? { error: opts.errorMessage } : undefined,
  });
}

/* ------------------------------------------------------------------ */
/* Truy vấn / lọc / xuất                                               */
/* ------------------------------------------------------------------ */

export interface AuditQuery {
  actorType?: AuditActorType | 'all';
  category?: AuditCategory | 'all';
  status?: AuditStatus | 'all';
  keyword?: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
}

export function matchLog(log: AuditLog, q: AuditQuery): boolean {
  if (q.actorType && q.actorType !== 'all' && log.actorType !== q.actorType) return false;
  if (q.category && q.category !== 'all' && log.category !== q.category) return false;
  if (q.status && q.status !== 'all' && log.status !== q.status) return false;
  if (q.from && log.timestamp < new Date(q.from).toISOString()) return false;
  if (q.to) {
    const end = new Date(q.to);
    end.setHours(23, 59, 59, 999);
    if (log.timestamp > end.toISOString()) return false;
  }
  if (q.keyword) {
    const k = q.keyword.trim().toLowerCase();
    if (k) {
      const hay = [
        log.actorName,
        log.description,
        log.action,
        log.targetType,
        String(log.targetId ?? ''),
        log.targetName,
        log.endpoint,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(k)) return false;
    }
  }
  return true;
}

const auditLogService = {
  /** Lấy log cục bộ (đã lọc). */
  getLocal(query: AuditQuery = {}): AuditLog[] {
    return readAll().filter((l) => matchLog(l, query));
  },

  /**
   * Thử lấy log từ backend (`/admin/audit-logs`) — bao gồm cả hành động của
   * người dùng. Nếu backend chưa có endpoint, trả về log cục bộ.
   */
  async getLogs(query: AuditQuery = {}): Promise<{ logs: AuditLog[]; source: 'remote' | 'local' }> {
    try {
      const res = await axiosClient.get('/admin/audit-logs');
      const data = res?.data?.data ?? res?.data;
      if (Array.isArray(data) && data.length >= 0 && res.status < 400) {
        const logs = (data as AuditLog[]).filter((l) => matchLog(l, query));
        return { logs, source: 'remote' };
      }
    } catch {
      /* backend chưa hỗ trợ -> dùng cục bộ */
    }
    return { logs: this.getLocal(query), source: 'local' };
  },

  clear(): void {
    writeAll([]);
  },

  /** Xoá toàn bộ nhật ký trên máy chủ. */
  async clearRemote(): Promise<void> {
    await axiosClient.delete('/admin/audit-logs');
  },

  /** Xuất ra chuỗi CSV. */
  toCsv(logs: AuditLog[]): string {
    const headers = [
      'Thời gian',
      'Loại chủ thể',
      'Người thực hiện',
      'Hành động',
      'Mô tả',
      'Nhóm',
      'Đối tượng',
      'Mã đối tượng',
      'Phương thức',
      'Endpoint',
      'Trạng thái',
      'Mã HTTP',
    ];
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = logs.map((l) =>
      [
        new Date(l.timestamp).toLocaleString('vi-VN'),
        l.actorType,
        l.actorName,
        l.action,
        l.description,
        l.category,
        l.targetType ?? '',
        l.targetId ?? '',
        l.method ?? '',
        l.endpoint ?? '',
        l.status,
        l.statusCode ?? '',
      ]
        .map(escape)
        .join(',')
    );
    return '﻿' + [headers.join(','), ...rows].join('\n');
  },
};

export default auditLogService;
