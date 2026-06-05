import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  Trash2,
  Eye,
  Heart,
  MessageCircle,
  Archive,
  Clock,
  Image,
  Video,
} from 'lucide-react';
import storyService from '../services/storyService';
import userService from '../services/userService';
import type { Story, User } from '../types/models';
import { buildS3Url } from '../utils/s3';

export default function Stories() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingStories, setLoadingStories] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewAll, setViewAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await userService.getAllUsers();
        setUsers(list);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Không tải được người dùng');
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (viewAll) {
      setLoadingStories(true);
      storyService
        .getAllStories()
        .then(setStories)
        .catch(() => {
          toast.error('Không tải được stories');
          setStories([]);
        })
        .finally(() => setLoadingStories(false));
      return;
    }
    if (!selectedUser) {
      setStories([]);
      return;
    }
    setLoadingStories(true);
    storyService
      .getStoriesByUser(selectedUser.id)
      .then(setStories)
      .catch(() => {
        toast.error('Không tải được stories');
        setStories([]);
      })
      .finally(() => setLoadingStories(false));
  }, [selectedUser, viewAll]);

  const filteredUsers = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return users;
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(k) ||
        (u.username || '').toLowerCase().includes(k)
    );
  }, [users, keyword]);

  const handleDelete = async (s: Story) => {
    if (!confirm('Xoá story này?')) return;
    setBusyId(s.id);
    try {
      await storyService.deleteStory(s.id);
      toast.success('Đã xoá story');
      setStories((arr) => arr.filter((x) => x.id !== s.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xoá story');
    } finally {
      setBusyId(null);
    }
  };

  const isExpired = (s: Story) => {
    if (!s.expireAt) return false;
    return new Date(s.expireAt).getTime() < Date.now();
  };

  const getUserInfo = (s: Story) => {
    if (s.user?.name || s.user?.username) return s.user;
    const found = users.find((u) => String(u.id) === s.userId);
    return found ? { name: found.name, username: found.username, avatarUrl: found.avatarUrl } : null;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Stories</h1>
        <p className="text-sm text-slate-500">Xem và kiểm duyệt stories của người dùng.</p>
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

          <button
            onClick={() => { setViewAll(true); setSelectedUser(null); }}
            className={`mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              viewAll ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tất cả stories
          </button>

          <ul className="mt-2 max-h-[65vh] space-y-1 overflow-y-auto pr-1">
            {loadingUsers ? (
              <li className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">Đang tải...</li>
            ) : (
              filteredUsers.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => { setSelectedUser(u); setViewAll(false); }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      !viewAll && selectedUser?.id === u.id
                        ? 'bg-indigo-50 ring-1 ring-indigo-200'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={buildS3Url(u.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${u.name || u.id}`}
                      className="h-9 w-9 rounded-full object-cover"
                      alt=""
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{u.name || `User #${u.id}`}</p>
                      <p className="truncate text-xs text-slate-500">@{u.username || '---'}</p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              {viewAll ? 'Tất cả stories trên hệ thống' : selectedUser ? `Stories của ${selectedUser.name || selectedUser.username || `User #${selectedUser.id}`}` : 'Chọn người dùng để xem stories'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{stories.length} stories</p>
          </div>

          {loadingStories ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
              Đang tải stories...
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-400">
              {viewAll || selectedUser ? 'Không có story nào.' : 'Chọn người dùng bên trái để bắt đầu.'}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stories.map((s) => {
                const user = getUserInfo(s);
                const expired = isExpired(s);
                return (
                  <article
                    key={s.id}
                    className={`overflow-hidden rounded-xl border bg-white shadow-sm ${expired ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}
                  >
                    <div className="relative h-48 w-full bg-slate-100">
                      {s.media?.url ? (
                        s.media.type === 'video' ? (
                          <div className="flex h-full items-center justify-center bg-slate-900">
                            <Video size={32} className="text-white/60" />
                            {s.media.thumbnailUrl && (
                              <img src={buildS3Url(s.media.thumbnailUrl) || ''} className="absolute inset-0 h-full w-full object-cover opacity-70" alt="" />
                            )}
                          </div>
                        ) : (
                          <img src={buildS3Url(s.media.url) || ''} className="h-full w-full object-cover" alt="" />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Image size={32} className="text-slate-300" />
                        </div>
                      )}

                      {expired && (
                        <span className="absolute left-2 top-2 rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Đã hết hạn
                        </span>
                      )}
                      {s.isArchived && (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-500/80 px-2 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1">
                          <Archive size={10} /> Lưu trữ
                        </span>
                      )}
                      {s.privacy && s.privacy !== 'PUBLIC' && (
                        <span className="absolute left-2 bottom-2 rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] text-white">
                          {s.privacy}
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      {viewAll && user && (
                        <div className="mb-2 flex items-center gap-2">
                          <img
                            src={buildS3Url(user.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name || s.userId}`}
                            className="h-6 w-6 rounded-full object-cover"
                            alt=""
                          />
                          <span className="text-xs font-medium text-slate-700">{user.name || user.username}</span>
                        </div>
                      )}

                      {s.text && (
                        <p className="text-sm text-slate-700 line-clamp-2 mb-2">{s.text}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Eye size={12} />{s.viewCount ?? 0}</span>
                        <span className="flex items-center gap-1"><Heart size={12} />{s.reactCount ?? 0}</span>
                        <span className="flex items-center gap-1"><MessageCircle size={12} />{s.replyCount ?? 0}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={10} />
                          {s.createdAt ? new Date(s.createdAt).toLocaleString('vi-VN') : '—'}
                        </span>
                        <button
                          disabled={busyId === s.id}
                          onClick={() => handleDelete(s)}
                          className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Trash2 size={12} /> Xoá
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
