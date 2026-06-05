import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BadgeCheck, RefreshCw, Search, Trash2, Filter } from 'lucide-react';
import pageService from '../services/pageService';
import type { Page, PageStatus } from '../types/models';
import { buildS3Url } from '../utils/s3';

type StatusFilter = 'all' | PageStatus;

export default function Pages() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await pageService.getAllPages();
      setPages(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không tải được danh sách trang');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return pages.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!k) return true;
      return (
        p.name?.toLowerCase().includes(k) ||
        p.username?.toLowerCase().includes(k) ||
        p.category?.toLowerCase().includes(k)
      );
    });
  }, [pages, keyword, statusFilter]);

  const handleDelete = async (e: React.MouseEvent, p: Page) => {
    e.stopPropagation();
    if (!confirm(`Xoá trang "${p.name}"?`)) return;
    setBusyId(p.id);
    try {
      await pageService.deletePage(p.id);
      toast.success('Đã xoá trang');
      setPages((arr) => arr.filter((x) => x.id !== p.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xoá trang');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Page</h1>
          <p className="text-sm text-slate-500">
            Tổng: <span className="font-semibold text-slate-700">{pages.length}</span> trang
            {filtered.length !== pages.length && (
              <span className="ml-2 text-slate-400">({filtered.length} hiển thị)</span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, username, danh mục..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
            <Filter size={14} className="ml-2 text-slate-400" />
            {(['all', 'ACTIVE', 'PENDING', 'BLOCKED'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === f
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f === 'all' ? 'Tất cả' : f === 'ACTIVE' ? 'Hoạt động' : f === 'PENDING' ? 'Chờ duyệt' : 'Bị chặn'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full rounded-xl border border-slate-100 bg-white p-10 text-center text-slate-400">
              Đang tải dữ liệu...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-400">
              Không có trang nào.
            </div>
          ) : (
            filtered.map((p) => (
              <article
                key={p.id}
                onClick={() => navigate(`/pages/${p.id}`)}
                className="cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md hover:border-indigo-200"
              >
                <div
                  className="h-24 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: p.coverUrl
                      ? `url(${buildS3Url(p.coverUrl)})`
                      : 'linear-gradient(135deg,#69b1ff,#1677ff)',
                  }}
                />
                <div className="-mt-8 flex items-end justify-between px-4">
                  <img
                    src={
                      buildS3Url(p.avatarUrl) ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`
                    }
                    className="h-16 w-16 rounded-xl border-4 border-white object-cover shadow"
                    alt=""
                  />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.status === 'BLOCKED'
                        ? 'bg-rose-50 text-rose-700'
                        : p.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {p.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="px-4 pb-4 pt-3">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-base font-semibold text-slate-900">{p.name}</h3>
                    {p.isVerified && <BadgeCheck size={16} className="text-indigo-500" />}
                  </div>
                  <p className="text-xs text-slate-500">@{p.username || '---'}</p>
                  {p.category && (
                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {p.category}
                    </span>
                  )}
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                    {p.description || 'Chưa có mô tả.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Tạo: {p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </span>
                    <button
                      disabled={busyId === p.id}
                      onClick={(e) => handleDelete(e, p)}
                      className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Xoá
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
