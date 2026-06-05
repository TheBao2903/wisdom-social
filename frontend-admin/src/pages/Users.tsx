import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Lock,
  Trash2,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Users2,
  FileText,
  Heart,
} from 'lucide-react';
import userService from '../services/userService';
import adminService from '../services/adminService';
import postService from '../services/postService';
import type { Post, User, UserProfile } from '../types/models';
import { buildS3Url } from '../utils/s3';

type FilterStatus = 'all' | 'active' | 'locked';
const PAGE_SIZE = 20;

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [lockTarget, setLockTarget] = useState<User | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [page, setPage] = useState(0);

  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [detailPosts, setDetailPosts] = useState<Post[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await userService.getAllUsers();
      setUsers(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không tải được danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'active' && u.locked) return false;
      if (filter === 'locked' && !u.locked) return false;
      if (!k) return true;
      return (
        (u.name || '').toLowerCase().includes(k) ||
        (u.username || '').toLowerCase().includes(k) ||
        (u.phone || '').toLowerCase().includes(k)
      );
    });
  }, [users, keyword, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(0);
  }, [keyword, filter]);

  const handleUnlock = async (u: User) => {
    setBusyId(u.id);
    try {
      await adminService.unlockUser(u.id);
      toast.success('Đã mở khoá tài khoản');
      setUsers((arr) => arr.map((x) => (x.id === u.id ? { ...x, locked: false } : x)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể mở khoá');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmLock = async () => {
    if (!lockTarget) return;
    setBusyId(lockTarget.id);
    try {
      await adminService.lockUser(lockTarget.id, lockReason || 'Vi phạm chính sách cộng đồng');
      toast.success('Đã khoá tài khoản');
      setUsers((arr) =>
        arr.map((x) => (x.id === lockTarget.id ? { ...x, locked: true, lockReason } : x))
      );
      setLockTarget(null);
      setLockReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể khoá');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`Xoá vĩnh viễn tài khoản ${u.name || u.username || u.id}?`)) return;
    setBusyId(u.id);
    try {
      await userService.deleteUser(u.id);
      toast.success('Đã xoá người dùng');
      setUsers((arr) => arr.filter((x) => x.id !== u.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xoá');
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (u: User) => {
    setDetailLoading(true);
    setDetailUser(null);
    setDetailPosts([]);
    try {
      const [profile, postsRes] = await Promise.all([
        userService.getProfile(u.id).catch(() => ({ ...u } as UserProfile)),
        postService.getPostsByUser(u.id, 0, 5).catch(() => ({ content: [] as Post[], totalElements: 0, totalPages: 0, number: 0, size: 0 })),
      ]);
      setDetailUser(profile);
      setDetailPosts(postsRes.content);
    } catch {
      toast.error('Không tải được thông tin chi tiết');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          <p className="text-sm text-slate-500">
            Tổng: <span className="font-semibold text-slate-700">{users.length}</span> tài khoản
            {filtered.length !== users.length && (
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
              placeholder="Tìm theo tên, username hoặc số điện thoại..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
            <Filter size={14} className="ml-2 text-slate-400" />
            {(['all', 'active', 'locked'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  filter === f
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f === 'all' ? 'Tất cả' : f === 'active' ? 'Hoạt động' : 'Bị khoá'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Người dùng</th>
                <th className="px-4 py-3 text-left">Liên hệ</th>
                <th className="px-4 py-3 text-left">Giới tính</th>
                <th className="px-4 py-3 text-left">Ngày sinh</th>
                <th className="px-4 py-3 text-left">Đăng ký</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Không có người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                paged.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(u)} className="flex items-center gap-3 text-left">
                        <img
                          src={
                            buildS3Url(u.avatarUrl) ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${u.name || u.username || u.id}`
                          }
                          className="h-9 w-9 rounded-full object-cover"
                          alt=""
                        />
                        <div>
                          <p className="font-medium text-slate-800 hover:text-indigo-600 transition">
                            {u.name || u.username || `User #${u.id}`}
                          </p>
                          <p className="text-xs text-slate-500">@{u.username || '---'}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.gender === 'MALE' ? 'Nam' : u.gender === 'FEMALE' ? 'Nữ' : 'Ẩn'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.birthday || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {u.locked ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="w-fit rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                            Đang khoá
                          </span>
                          {u.lockReason && (
                            <span className="text-[11px] text-slate-400">{u.lockReason}</span>
                          )}
                        </div>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Hoạt động
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetail(u)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <Eye size={14} /> Chi tiết
                        </button>
                        {u.locked ? (
                          <button
                            disabled={busyId === u.id}
                            onClick={() => handleUnlock(u)}
                            className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <Unlock size={14} /> Mở khoá
                          </button>
                        ) : (
                          <button
                            disabled={busyId === u.id}
                            onClick={() => {
                              setLockTarget(u);
                              setLockReason('');
                            }}
                            className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <Lock size={14} /> Khoá
                          </button>
                        )}
                        <button
                          disabled={busyId === u.id}
                          onClick={() => handleDelete(u)}
                          className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Trash2 size={14} /> Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Trang {page + 1} / {totalPages}
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

      {/* Lock Modal */}
      {lockTarget && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Khoá tài khoản: {lockTarget.name || lockTarget.username || `#${lockTarget.id}`}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Người dùng sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập lại cho tới khi được mở khoá.
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">Lý do</label>
            <textarea
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              rows={3}
              placeholder="Vi phạm chính sách cộng đồng..."
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setLockTarget(null);
                  setLockReason('');
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleConfirmLock}
                disabled={busyId === lockTarget.id}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-rose-300"
              >
                {busyId === lockTarget.id ? 'Đang xử lý...' : 'Xác nhận khoá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      {(detailUser || detailLoading) && (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/40" onClick={() => { setDetailUser(null); setDetailLoading(false); }}>
          <div
            className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Chi tiết người dùng</h3>
              <button
                onClick={() => { setDetailUser(null); setDetailLoading(false); }}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex h-64 items-center justify-center text-slate-400">Đang tải...</div>
            ) : detailUser && (
              <div className="space-y-6 p-6">
                {/* Profile header */}
                <div className="flex items-center gap-4">
                  <img
                    src={buildS3Url(detailUser.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${detailUser.name || detailUser.id}`}
                    className="h-16 w-16 rounded-full object-cover"
                    alt=""
                  />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {detailUser.name || `User #${detailUser.id}`}
                    </p>
                    <p className="text-sm text-slate-500">@{detailUser.username || '---'}</p>
                    <p className="text-xs text-slate-400">{detailUser.phone}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <Users2 size={16} className="mx-auto text-indigo-500" />
                    <p className="mt-1 text-lg font-bold text-slate-800">{detailUser.friendsCount ?? '—'}</p>
                    <p className="text-[11px] text-slate-500">Bạn bè</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <Heart size={16} className="mx-auto text-pink-500" />
                    <p className="mt-1 text-lg font-bold text-slate-800">{detailUser.followersCount ?? '—'}</p>
                    <p className="text-[11px] text-slate-500">Theo dõi</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <FileText size={16} className="mx-auto text-emerald-500" />
                    <p className="mt-1 text-lg font-bold text-slate-800">{detailUser.postsCount ?? '—'}</p>
                    <p className="text-[11px] text-slate-500">Bài đăng</p>
                  </div>
                </div>

                {/* Info */}
                <div className="rounded-xl border border-slate-100 p-4">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Thông tin</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Giới tính</dt>
                      <dd className="text-slate-700">
                        {detailUser.gender === 'MALE' ? 'Nam' : detailUser.gender === 'FEMALE' ? 'Nữ' : 'Ẩn'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Ngày sinh</dt>
                      <dd className="text-slate-700">{detailUser.birthday || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Tiểu sử</dt>
                      <dd className="text-slate-700 text-right max-w-[200px] truncate">{detailUser.bio || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Đăng ký</dt>
                      <dd className="text-slate-700">
                        {detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleDateString('vi-VN') : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Hoạt động cuối</dt>
                      <dd className="text-slate-700">
                        {detailUser.lastActiveAt ? new Date(detailUser.lastActiveAt).toLocaleString('vi-VN') : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Lock info */}
                {detailUser.locked && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <h4 className="text-sm font-semibold text-rose-800 mb-2">Thông tin khoá</h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-rose-600">Lý do</dt>
                        <dd className="text-rose-800">{detailUser.lockReason || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-rose-600">Khoá bởi</dt>
                        <dd className="text-rose-800">{detailUser.lockedBy || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-rose-600">Thời gian khoá</dt>
                        <dd className="text-rose-800">
                          {detailUser.lockedAt ? new Date(detailUser.lockedAt).toLocaleString('vi-VN') : '—'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                {/* Recent posts */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Bài đăng gần đây</h4>
                  {detailPosts.length === 0 ? (
                    <p className="text-sm text-slate-400">Chưa có bài đăng.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailPosts.map((p) => (
                        <div key={p.id} className="rounded-lg border border-slate-100 p-3">
                          <p className="text-sm text-slate-700 line-clamp-2">{p.content || '(Không có nội dung)'}</p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                            <span>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : ''}</span>
                            <span>{p.stats?.reactionCount ?? 0} reactions</span>
                            <span>{p.stats?.commentCount ?? 0} comments</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
