import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Heart,
  MessageCircle,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import postService from '../services/postService';
import userService from '../services/userService';
import type { Post, User, PaginatedResponse } from '../types/models';
import { buildS3Url } from '../utils/s3';

const POSTS_PER_PAGE = 10;

export default function Posts() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [postsData, setPostsData] = useState<PaginatedResponse<Post>>({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: POSTS_PER_PAGE,
  });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const list = await userService.getAllUsers();
        setUsers(list);
        if (list.length > 0) setSelectedUser(list[0]);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Không tải được người dùng');
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setLoadingPosts(true);
    postService
      .getPostsByUser(selectedUser.id, page, POSTS_PER_PAGE)
      .then(setPostsData)
      .catch((err) => {
        toast.error(err?.response?.data?.message || 'Không tải được bài đăng');
        setPostsData({ content: [], totalElements: 0, totalPages: 0, number: 0, size: POSTS_PER_PAGE });
      })
      .finally(() => setLoadingPosts(false));
  }, [selectedUser, page]);

  useEffect(() => {
    setPage(0);
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return users;
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(k) ||
        (u.username || '').toLowerCase().includes(k) ||
        (u.phone || '').toLowerCase().includes(k)
    );
  }, [users, keyword]);

  const handleDelete = async (p: Post) => {
    if (!confirm('Xoá bài đăng này?')) return;
    setBusyId(p.id);
    try {
      await postService.deletePost(p.id);
      toast.success('Đã xoá bài đăng');
      setPostsData((prev) => ({
        ...prev,
        content: prev.content.filter((x) => x.id !== p.id),
        totalElements: prev.totalElements - 1,
      }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xoá bài đăng');
    } finally {
      setBusyId(null);
    }
  };

  const posts = postsData.content;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý bài đăng</h1>
        <p className="text-sm text-slate-500">Chọn người dùng để xem và kiểm duyệt bài đăng của họ.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm người dùng..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <ul className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto pr-1">
            {loadingUsers ? (
              <li className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
                Đang tải...
              </li>
            ) : (
              filteredUsers.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => setSelectedUser(u)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      selectedUser?.id === u.id
                        ? 'bg-indigo-50 ring-1 ring-indigo-200'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={
                        buildS3Url(u.avatarUrl) ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${u.name || u.username || u.id}`
                      }
                      className="h-9 w-9 rounded-full object-cover"
                      alt=""
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {u.name || u.username || `User #${u.id}`}
                      </p>
                      <p className="truncate text-xs text-slate-500">@{u.username || '---'}</p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">Đang xem bài đăng của</p>
              <p className="text-lg font-semibold text-slate-900">
                {selectedUser ? selectedUser.name || selectedUser.username || `User #${selectedUser.id}` : '—'}
              </p>
              {postsData.totalElements > 0 && (
                <p className="text-xs text-slate-400">{postsData.totalElements} bài đăng</p>
              )}
            </div>
            <button
              onClick={() => selectedUser && setSelectedUser({ ...selectedUser })}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Làm mới
            </button>
          </div>

          {loadingPosts ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
              Đang tải bài đăng...
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-400">
              Người dùng này chưa có bài đăng.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {posts.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <header className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            buildS3Url(selectedUser?.avatarUrl) ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${selectedUser?.name || 'U'}`
                          }
                          className="h-10 w-10 rounded-full object-cover"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {selectedUser?.name || selectedUser?.username}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : ''}
                            {' · '}
                            <span className="font-medium text-slate-600">{p.privacy || 'PUBLIC'}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => handleDelete(p)}
                        className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> Xoá
                      </button>
                    </header>

                    {p.content && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{p.content}</p>
                    )}

                    {p.media && p.media.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {p.media.slice(0, 6).map((m, i) => (
                          <img
                            key={i}
                            src={buildS3Url(m.url) || ''}
                            className="h-32 w-full rounded-lg object-cover"
                            alt=""
                          />
                        ))}
                      </div>
                    )}

                    {p.hashtags && p.hashtags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.hashtags.map((h, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                          >
                            #{h}
                          </span>
                        ))}
                      </div>
                    )}

                    <footer className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Heart size={14} /> {p.stats?.reactionCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle size={14} /> {p.stats?.commentCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Share2 size={14} /> {p.stats?.shareCount ?? 0}
                      </span>
                      <span className="ml-auto text-[11px] uppercase tracking-wider text-slate-400">
                        {p.status || 'ACTIVE'}
                      </span>
                    </footer>
                  </article>
                ))}
              </div>

              {postsData.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Trang {postsData.number + 1} / {postsData.totalPages} · {postsData.totalElements} bài
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
                      disabled={page >= postsData.totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Sau <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
