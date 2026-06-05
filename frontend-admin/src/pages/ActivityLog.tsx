import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  RefreshCw,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  ShieldCheck,
  UserCog,
  ServerCog,
  CheckCircle2,
  XCircle,
  Activity,
  CalendarClock,
} from 'lucide-react';
import auditLogService, { matchLog, type AuditQuery } from '../services/auditLogService';
import type { AuditActorType, AuditCategory, AuditLog, AuditStatus } from '../types/models';

const PAGE_SIZE = 25;

/** Hiển thị số điện thoại VN dạng nội địa: +84398721346 -> 0398721346 */
const formatActor = (name?: string) => (name ? name.replace(/^\+84/, '0') : name || '');

/** Mô tả request chung hiển thị theo phương thức HTTP (GET/POST/...) thay vì "Truy cập". */
const formatDescription = (log: AuditLog) =>
  log.description?.startsWith('Truy cập ')
    ? `${log.method || 'GET'} ${log.description.slice('Truy cập '.length)}`
    : log.description;

const ACTOR_META: Record<AuditActorType, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  ADMIN: { label: 'Quản trị viên', cls: 'bg-indigo-50 text-indigo-700', Icon: ShieldCheck },
  USER: { label: 'Người dùng', cls: 'bg-sky-50 text-sky-700', Icon: UserCog },
  SYSTEM: { label: 'Hệ thống', cls: 'bg-slate-100 text-slate-600', Icon: ServerCog },
};

const CATEGORY_META: Record<AuditCategory, { label: string; cls: string }> = {
  AUTH: { label: 'Xác thực', cls: 'bg-violet-50 text-violet-700' },
  USER: { label: 'Người dùng', cls: 'bg-blue-50 text-blue-700' },
  PAGE: { label: 'Trang', cls: 'bg-amber-50 text-amber-700' },
  POST: { label: 'Bài đăng', cls: 'bg-emerald-50 text-emerald-700' },
  STORY: { label: 'Story', cls: 'bg-pink-50 text-pink-700' },
  MUSIC: { label: 'Nhạc', cls: 'bg-fuchsia-50 text-fuchsia-700' },
  REPORT: { label: 'Báo cáo', cls: 'bg-rose-50 text-rose-700' },
  SYSTEM: { label: 'Hệ thống', cls: 'bg-slate-100 text-slate-600' },
};

const ACTOR_FILTERS: Array<{ value: AuditActorType | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả chủ thể' },
  { value: 'ADMIN', label: 'Quản trị viên' },
  { value: 'USER', label: 'Người dùng' },
  { value: 'SYSTEM', label: 'Hệ thống' },
];

const CATEGORY_FILTERS: Array<{ value: AuditCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả nhóm' },
  { value: 'AUTH', label: 'Xác thực' },
  { value: 'USER', label: 'Người dùng' },
  { value: 'PAGE', label: 'Trang' },
  { value: 'POST', label: 'Bài đăng' },
  { value: 'STORY', label: 'Story' },
  { value: 'MUSIC', label: 'Nhạc' },
  { value: 'REPORT', label: 'Báo cáo' },
  { value: 'SYSTEM', label: 'Hệ thống' },
];

export default function ActivityLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'remote' | 'local'>('local');

  const [keyword, setKeyword] = useState('');
  const [actorType, setActorType] = useState<AuditActorType | 'all'>('all');
  const [category, setCategory] = useState<AuditCategory | 'all'>('all');
  const [status, setStatus] = useState<AuditStatus | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const [live, setLive] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const query: AuditQuery = useMemo(
    () => ({ actorType, category, status, keyword, from, to }),
    [actorType, category, status, keyword, from, to]
  );

  // Bộ lọc hiện tại để handler SSE luôn đọc giá trị mới nhất
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const load = async () => {
    setLoading(true);
    try {
      const { logs: data, source: src } = await auditLogService.getLogs(query);
      setLogs(data);
      setSource(src);
    } catch {
      toast.error('Không tải được nhật ký hoạt động');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [keyword, actorType, category, status, from, to]);

  // Realtime: lắng nghe log mới qua SSE (chỉ khi backend có endpoint)
  useEffect(() => {
    if (source !== 'remote') {
      setLive(false);
      return;
    }
    const es = new EventSource('/api/admin/audit-logs/stream', { withCredentials: true });

    es.addEventListener('connected', () => setLive(true));
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);

    es.addEventListener('audit', (e) => {
      try {
        const log = JSON.parse((e as MessageEvent).data) as AuditLog;
        setLogs((prev) => {
          if (prev.some((p) => p.id === log.id)) return prev;
          if (!matchLog(log, queryRef.current)) return prev;
          return [log, ...prev];
        });
      } catch {
        /* bỏ qua bản ghi lỗi định dạng */
      }
    });

    // Nhật ký bị xoá ở nơi khác -> làm trống danh sách
    es.addEventListener('cleared', () => setLogs([]));

    return () => es.close();
  }, [source]);

  const stats = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return {
      total: logs.length,
      success: logs.filter((l) => l.status === 'SUCCESS').length,
      failed: logs.filter((l) => l.status === 'FAILED').length,
      today: logs.filter((l) => l.timestamp.slice(0, 10) === todayPrefix).length,
    };
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paged = useMemo(
    () => logs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [logs, page]
  );

  const handleExport = () => {
    if (logs.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }
    const csv = auditLogService.toCsv(logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nhat-ky-hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${logs.length} bản ghi`);
  };

  const doClear = async () => {
    setClearing(true);
    try {
      if (source === 'remote') {
        await auditLogService.clearRemote();
      } else {
        auditLogService.clear();
      }
      setLogs([]);
      toast.success('Đã xoá nhật ký');
      setConfirmingClear(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xoá nhật ký');
    } finally {
      setClearing(false);
    }
  };

  const resetFilters = () => {
    setKeyword('');
    setActorType('all');
    setCategory('all');
    setStatus('all');
    setFrom('');
    setTo('');
  };

  const hasFilters = !!(keyword || actorType !== 'all' || category !== 'all' || status !== 'all' || from || to);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhật ký hoạt động</h1>
          <p className="text-sm text-slate-500">
            Ghi lại hành động của quản trị viên và người dùng để truy vết.
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Nguồn: {source === 'remote' ? 'Máy chủ' : 'Thiết bị này'}
            </span>
            {live && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Trực tiếp
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download size={14} /> Xuất CSV
          </button>
          <button
            onClick={() => setConfirmingClear(true)}
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 hover:bg-rose-100"
          >
            <Trash2 size={14} /> Xoá log
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={<Activity size={18} />} label="Tổng bản ghi" value={stats.total} tone="indigo" />
        <StatTile icon={<CheckCircle2 size={18} />} label="Thành công" value={stats.success} tone="emerald" />
        <StatTile icon={<XCircle size={18} />} label="Thất bại" value={stats.failed} tone="rose" />
        <StatTile icon={<CalendarClock size={18} />} label="Hôm nay" value={stats.today} tone="sky" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo người thực hiện, hành động, đối tượng..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={actorType}
            onChange={(e) => setActorType(e.target.value as AuditActorType | 'all')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:border-indigo-400 focus:outline-none"
          >
            {ACTOR_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AuditCategory | 'all')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 focus:border-indigo-400 focus:outline-none"
          >
            {CATEGORY_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
            <Filter size={14} className="ml-2 text-slate-400" />
            {(['all', 'SUCCESS', 'FAILED'] as Array<AuditStatus | 'all'>).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  status === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s === 'all' ? 'Tất cả' : s === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Từ ngày
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-600 focus:border-indigo-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Đến ngày
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-600 focus:border-indigo-400 focus:outline-none"
            />
          </label>
          {hasFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
              <X size={14} /> Xoá bộ lọc
            </button>
          )}
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Thời gian</th>
                <th className="px-4 py-3 text-left">Người thực hiện</th>
                <th className="px-4 py-3 text-left">Hành động</th>
                <th className="px-4 py-3 text-left">Nhóm</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">Đang tải dữ liệu...</td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Chưa có hoạt động nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                paged.map((log) => {
                  const actor = ACTOR_META[log.actorType];
                  const cat = CATEGORY_META[log.category];
                  return (
                    <tr key={log.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetail(log)}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${actor.cls}`}>
                            <actor.Icon size={14} />
                          </span>
                          <div>
                            <p className="font-medium text-slate-800">{formatActor(log.actorName)}</p>
                            <p className="text-[11px] text-slate-400">{actor.label}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{formatDescription(log)}</p>
                        <p className="text-[11px] text-slate-400">{log.action}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cat.cls}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={12} /> Thành công
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                            <XCircle size={12} /> Thất bại
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Trang {page + 1} / {totalPages} · {logs.length} bản ghi
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm clear modal */}
      {confirmingClear && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !clearing && setConfirmingClear(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 size={20} />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Xoá toàn bộ nhật ký</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {source === 'remote'
                    ? 'Toàn bộ lịch sử nhật ký trên máy chủ sẽ bị xoá vĩnh viễn và không thể khôi phục.'
                    : 'Toàn bộ nhật ký đã lưu trên thiết bị này sẽ bị xoá.'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmingClear(false)}
                disabled={clearing}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                onClick={doClear}
                disabled={clearing}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-rose-300"
              >
                {clearing ? 'Đang xoá...' : 'Xoá toàn bộ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Chi tiết hoạt động</h3>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-6 text-sm">
              <Field label="Mô tả" value={formatDescription(detail)} strong />
              <Field label="Mã hành động" value={detail.action} mono />
              <Field
                label="Người thực hiện"
                value={`${formatActor(detail.actorName)} (${ACTOR_META[detail.actorType].label})`}
                strong
              />
              <Field label="Nhóm" value={CATEGORY_META[detail.category].label} />
              <Field
                label="Đối tượng"
                value={
                  detail.targetType
                    ? `${detail.targetName || detail.targetType}${detail.targetId != null ? ` #${detail.targetId}` : ''}`
                    : '—'
                }
              />
              <Field label="Thời gian" value={new Date(detail.timestamp).toLocaleString('vi-VN')} strong />
              <Field
                label="Trạng thái"
                value={`${detail.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'}${detail.statusCode ? ` (HTTP ${detail.statusCode})` : ''}`}
                strong
                valueClass={detail.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}
              />
              {(detail.method || detail.endpoint) && (
                <Field label="Endpoint" value={`${detail.method || ''} ${detail.endpoint || ''}`} mono />
              )}
              {detail.meta && Object.keys(detail.meta).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dữ liệu bổ sung</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    {JSON.stringify(detail.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'indigo' | 'emerald' | 'rose' | 'sky';
}) {
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  strong,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-0.5 break-words ${strong ? 'text-[15px] font-bold' : ''} ${
          mono ? 'font-mono text-xs' : ''
        } ${valueClass || (strong ? 'text-slate-900' : 'text-slate-700')}`}
      >
        {value}
      </p>
    </div>
  );
}
