import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  BadgeCheck,
  Users,
  FileText,
  Clock,
  ShieldBan,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import pageService from '../services/pageService';
import type { Page, PageMember, Post } from '../types/models';
import { buildS3Url } from '../utils/s3';

type Tab = 'info' | 'members' | 'requests' | 'posts' | 'pending';

export default function PageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pageId = Number(id);

  const [page, setPage] = useState<Page | null>(null);
  const [members, setMembers] = useState<PageMember[]>([]);
  const [requests, setRequests] = useState<PageMember[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    Promise.all([
      pageService.getPageById(pageId).catch(() => null),
      pageService.getMemberCount(pageId).catch(() => 0),
    ])
      .then(([p, count]) => {
        setPage(p);
        setMemberCount(count);
      })
      .finally(() => setLoading(false));
  }, [pageId]);

  useEffect(() => {
    if (!pageId) return;
    if (tab === 'members') {
      pageService.getPageMembers(pageId).then(setMembers).catch(() => setMembers([]));
    } else if (tab === 'requests') {
      pageService.getPendingJoinRequests(pageId).then(setRequests).catch(() => setRequests([]));
    } else if (tab === 'posts') {
      pageService.getPagePosts(pageId).then(setPosts).catch(() => setPosts([]));
    } else if (tab === 'pending') {
      pageService.getWaitingPosts(pageId).then(setPendingPosts).catch(() => setPendingPosts([]));
    }
  }, [pageId, tab]);

  const handleApproveRequest = async (userId: number) => {
    setBusyAction(`approve-${userId}`);
    try {
      await pageService.approveMember(pageId, userId);
      toast.success('Đã duyệt yêu cầu');
      setRequests((arr) => arr.filter((r) => r.userId !== userId));
      setMemberCount((c) => c + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể duyệt');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRejectRequest = async (userId: number) => {
    setBusyAction(`reject-${userId}`);
    try {
      await pageService.rejectMember(pageId, userId);
      toast.success('Đã từ chối yêu cầu');
      setRequests((arr) => arr.filter((r) => r.userId !== userId));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể từ chối');
    } finally {
      setBusyAction(null);
    }
  };

  const handleBlockMember = async (userId: number) => {
    setBusyAction(`block-${userId}`);
    try {
      await pageService.blockMember(pageId, userId);
      toast.success('Đã chặn thành viên');
      setMembers((arr) => arr.map((m) => (m.userId === userId ? { ...m, status: 'BLOCKED' } : m)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể chặn');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Xoá thành viên này khỏi trang?')) return;
    setBusyAction(`remove-${userId}`);
    try {
      await pageService.removeMember(pageId, userId);
      toast.success('Đã xoá thành viên');
      setMembers((arr) => arr.filter((m) => m.userId !== userId));
      setMemberCount((c) => Math.max(0, c - 1));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xoá');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprovePost = async (post: Post) => {
    setBusyAction(`approve-post-${post.id}`);
    try {
      await pageService.approvePost(Number(post.authorId), pageId, post.id);
      toast.success('Đã duyệt bài đăng');
      setPendingPosts((arr) => arr.filter((p) => p.id !== post.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể duyệt');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemovePost = async (post: Post) => {
    setBusyAction(`remove-post-${post.id}`);
    try {
      await pageService.removePost(Number(post.authorId), pageId, post.id);
      toast.success('Đã xoá bài đăng');
      setPosts((arr) => arr.filter((p) => p.id !== post.id));
      setPendingPosts((arr) => arr.filter((p) => p.id !== post.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xoá');
    } finally {
      setBusyAction(null);
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'info', label: 'Thông tin', icon: FileText },
    { key: 'members', label: 'Thành viên', icon: Users },
    { key: 'requests', label: 'Yêu cầu tham gia', icon: Clock },
    { key: 'posts', label: 'Bài đăng', icon: FileText },
    { key: 'pending', label: 'Chờ duyệt', icon: Clock },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">Đang tải thông tin trang...</div>
    );
  }

  if (!page) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/pages')} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">
          Không tìm thấy trang này.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/pages')} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Quay lại danh sách
      </button>

      {/* Page Header */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="h-32 w-full bg-cover bg-center"
          style={{
            backgroundImage: page.coverUrl
              ? `url(${buildS3Url(page.coverUrl)})`
              : 'linear-gradient(135deg,#69b1ff,#1677ff)',
          }}
        />
        <div className="px-6 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <img
              src={buildS3Url(page.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${page.name}`}
              className="h-20 w-20 rounded-xl border-4 border-white object-cover shadow"
              alt=""
            />
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{page.name}</h1>
                {page.isVerified && <BadgeCheck size={20} className="text-indigo-500" />}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    page.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {page.status || 'ACTIVE'}
                </span>
              </div>
              <p className="text-sm text-slate-500">@{page.username || '---'} · {memberCount} thành viên</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {tab === 'info' && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div><dt className="text-slate-500">Tên trang</dt><dd className="mt-1 font-medium text-slate-800">{page.name}</dd></div>
            <div><dt className="text-slate-500">Username</dt><dd className="mt-1 font-medium text-slate-800">@{page.username || '—'}</dd></div>
            <div><dt className="text-slate-500">Danh mục</dt><dd className="mt-1 font-medium text-slate-800">{page.category || '—'}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="mt-1 font-medium text-slate-800">{page.email || '—'}</dd></div>
            <div><dt className="text-slate-500">Số điện thoại</dt><dd className="mt-1 font-medium text-slate-800">{page.phone || '—'}</dd></div>
            <div><dt className="text-slate-500">Website</dt><dd className="mt-1 font-medium text-slate-800">{page.website || '—'}</dd></div>
            <div><dt className="text-slate-500">Địa chỉ</dt><dd className="mt-1 font-medium text-slate-800">{page.address || '—'}</dd></div>
            <div><dt className="text-slate-500">Ngày tạo</dt><dd className="mt-1 font-medium text-slate-800">{page.createdAt ? new Date(page.createdAt).toLocaleDateString('vi-VN') : '—'}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">Mô tả</dt><dd className="mt-1 text-slate-700">{page.description || 'Chưa có mô tả.'}</dd></div>
            {page.createdBy && (
              <div className="col-span-2">
                <dt className="text-slate-500">Người tạo</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <img
                    src={buildS3Url(page.createdBy.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${page.createdBy.name || page.createdBy.id}`}
                    className="h-6 w-6 rounded-full object-cover"
                    alt=""
                  />
                  <span className="font-medium text-slate-800">{page.createdBy.name || page.createdBy.username}</span>
                </dd>
              </div>
            )}
          </dl>
        )}

        {tab === 'members' && (
          <div>
            <p className="mb-4 text-sm text-slate-500">Tổng: {members.length} thành viên</p>
            {members.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có thành viên.</p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={buildS3Url(m.user?.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${m.user?.name || m.userId}`}
                        className="h-9 w-9 rounded-full object-cover"
                        alt=""
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{m.user?.name || `User #${m.userId}`}</p>
                        <p className="text-xs text-slate-500">
                          {m.role && <span className="mr-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">{m.role}</span>}
                          {m.status === 'BLOCKED' && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">Bị chặn</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {m.status !== 'BLOCKED' && (
                        <button
                          disabled={busyAction === `block-${m.userId}`}
                          onClick={() => handleBlockMember(m.userId)}
                          className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          <ShieldBan size={12} /> Chặn
                        </button>
                      )}
                      <button
                        disabled={busyAction === `remove-${m.userId}`}
                        onClick={() => handleRemoveMember(m.userId)}
                        className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Xoá
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'requests' && (
          <div>
            <p className="mb-4 text-sm text-slate-500">Yêu cầu đang chờ: {requests.length}</p>
            {requests.length === 0 ? (
              <p className="text-sm text-slate-400">Không có yêu cầu nào.</p>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={buildS3Url(r.user?.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${r.user?.name || r.userId}`}
                        className="h-9 w-9 rounded-full object-cover"
                        alt=""
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.user?.name || `User #${r.userId}`}</p>
                        <p className="text-xs text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={busyAction === `approve-${r.userId}`}
                        onClick={() => handleApproveRequest(r.userId)}
                        className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <Check size={14} /> Duyệt
                      </button>
                      <button
                        disabled={busyAction === `reject-${r.userId}`}
                        onClick={() => handleRejectRequest(r.userId)}
                        className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <X size={14} /> Từ chối
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'posts' && (
          <div>
            <p className="mb-4 text-sm text-slate-500">Tổng: {posts.length} bài đăng</p>
            {posts.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có bài đăng.</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-100 p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{p.content || '(Không có nội dung)'}</p>
                    {p.media && p.media.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {p.media.slice(0, 3).map((m, i) => (
                          <img key={i} src={buildS3Url(m.url) || ''} className="h-16 w-16 rounded-lg object-cover" alt="" />
                        ))}
                        {p.media.length > 3 && (
                          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">+{p.media.length - 3}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : ''} · {p.stats?.reactionCount ?? 0} reactions · {p.stats?.commentCount ?? 0} comments</span>
                      <button
                        disabled={busyAction === `remove-post-${p.id}`}
                        onClick={() => handleRemovePost(p)}
                        className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Xoá
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'pending' && (
          <div>
            <p className="mb-4 text-sm text-slate-500">Bài chờ duyệt: {pendingPosts.length}</p>
            {pendingPosts.length === 0 ? (
              <p className="text-sm text-slate-400">Không có bài nào chờ duyệt.</p>
            ) : (
              <div className="space-y-3">
                {pendingPosts.map((p) => (
                  <div key={p.id} className="rounded-lg border border-amber-100 bg-amber-50/30 p-4">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{p.content || '(Không có nội dung)'}</p>
                    {p.media && p.media.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {p.media.slice(0, 3).map((m, i) => (
                          <img key={i} src={buildS3Url(m.url) || ''} className="h-16 w-16 rounded-lg object-cover" alt="" />
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : ''}</span>
                      <div className="flex gap-2">
                        <button
                          disabled={busyAction === `approve-post-${p.id}`}
                          onClick={() => handleApprovePost(p)}
                          className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <Check size={14} /> Duyệt
                        </button>
                        <button
                          disabled={busyAction === `remove-post-${p.id}`}
                          onClick={() => handleRemovePost(p)}
                          className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Trash2 size={14} /> Xoá
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
