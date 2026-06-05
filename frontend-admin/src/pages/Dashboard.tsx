import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Newspaper,
  FileText,
  ShieldAlert,
  TrendingUp,
  Activity,
  Hash,
  BookImage,
  Music2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import StatCard from '../components/common/StatCard';
import userService from '../services/userService';
import pageService from '../services/pageService';
import hashtagService from '../services/hashtagService';
import adminService from '../services/adminService';
import type { AdminStats, Page, TrendingHashtag, User } from '../types/models';
import { buildS3Url } from '../utils/s3';

const PIE_COLORS = ['#1677ff', '#ec4899', '#94a3b8'];
const HASHTAG_COLORS = ['#1677ff', '#4096ff', '#69b1ff', '#91caff', '#0958d9', '#003eb3', '#bae0ff', '#002c8c'];

function buildGenderDistribution(users: User[]) {
  const counts = { Nam: 0, Nữ: 0, Khác: 0 };
  for (const u of users) {
    if (u.gender === 'MALE') counts.Nam += 1;
    else if (u.gender === 'FEMALE') counts.Nữ += 1;
    else counts.Khác += 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function buildPagesByCategory(pages: Page[]) {
  const map = new Map<string, number>();
  for (const p of pages) {
    const k = p.category || 'Khác';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [trending, setTrending] = useState<TrendingHashtag[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [u, p, h, s] = await Promise.all([
          userService.getAllUsers().catch(() => []),
          pageService.getAllPages().catch(() => []),
          hashtagService.getTrending().catch(() => []),
          adminService.getStats().catch(() => null),
        ]);
        if (!alive) return;
        setUsers(u);
        setPages(p);
        setTrending(h);
        setStats(s);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const fallbackStats = useMemo(() => {
    if (stats) return null;
    const totalUsers = users.length;
    const lockedUsers = users.filter((u) => u.locked).length;
    const totalPages = pages.length;
    const verifiedPages = pages.filter((p) => p.isVerified).length;
    const activeToday = users.filter((u) => {
      if (!u.lastActiveAt) return false;
      return Date.now() - new Date(u.lastActiveAt).getTime() < 24 * 60 * 60 * 1000;
    }).length;
    const newThisWeek = users.filter((u) => {
      if (!u.createdAt) return false;
      return Date.now() - new Date(u.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { totalUsers, lockedUsers, totalPages, verifiedPages, activeToday, newThisWeek };
  }, [users, pages, stats]);

  const genderSeries = useMemo(() => buildGenderDistribution(users), [users]);
  const pageCategorySeries = useMemo(() => buildPagesByCategory(pages), [pages]);

  const trendingSeries = useMemo(
    () => trending.slice(0, 8).map((h) => ({ tag: `#${h.tag}`, posts: h.postCount ?? 0 })),
    [trending]
  );

  const recentUsers = useMemo(
    () => [...users].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 6),
    [users]
  );

  const signupSeries = stats?.registrationsByDay?.map((d) => ({ day: d.date.slice(5), count: d.count })) ?? [];
  const postsSeries = stats?.postsByDay?.map((d) => ({ day: d.date.slice(5), count: d.count })) ?? [];

  const totalUsers = stats?.totalUsers ?? fallbackStats?.totalUsers ?? 0;
  const activeToday = stats?.activeToday ?? fallbackStats?.activeToday ?? 0;
  const newThisWeek = stats?.newThisWeek ?? fallbackStats?.newThisWeek ?? 0;
  const lockedUsers = stats?.lockedUsers ?? fallbackStats?.lockedUsers ?? 0;
  const totalPages = stats?.totalPages ?? fallbackStats?.totalPages ?? 0;
  const verifiedPages = fallbackStats?.verifiedPages ?? pages.filter((p) => p.isVerified).length;
  const totalPosts = stats?.totalPosts ?? 0;
  const totalStories = stats?.totalStories ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h1>
          <p className="text-sm text-slate-500">
            Theo dõi nhanh các chỉ số quan trọng và hoạt động gần đây của Wisdom Social.
          </p>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          {loading ? 'Đang tải dữ liệu...' : stats ? 'Đã đồng bộ (API)' : 'Đã đồng bộ'}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Tổng người dùng" value={totalUsers.toLocaleString()} delta={`+${newThisWeek} mới`} deltaTone="up" icon={Users} />
        <StatCard title="Đang hoạt động hôm nay" value={activeToday.toLocaleString()} delta="24h gần nhất" deltaTone="neutral" icon={Activity} accent="from-emerald-500 to-teal-600" />
        <StatCard title="Tổng số Page" value={totalPages.toLocaleString()} delta={`${verifiedPages} đã xác minh`} deltaTone="up" icon={Newspaper} accent="from-amber-500 to-orange-600" />
        <StatCard title="Tài khoản bị khoá" value={lockedUsers.toLocaleString()} delta={lockedUsers > 0 ? 'Cần kiểm tra' : 'Bình thường'} deltaTone={lockedUsers > 0 ? 'down' : 'up'} icon={ShieldAlert} accent="from-rose-500 to-pink-600" />
        <StatCard title="Tổng bài đăng" value={totalPosts.toLocaleString()} delta="Toàn hệ thống" deltaTone="neutral" icon={FileText} accent="from-violet-500 to-purple-600" />
        <StatCard title="Tổng Stories" value={totalStories.toLocaleString()} delta="Toàn hệ thống" deltaTone="neutral" icon={BookImage} accent="from-sky-500 to-cyan-600" />
      </div>

      {/* Charts row 1: Signups + Gender */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Người dùng đăng ký mới</h2>
              <p className="text-xs text-slate-500">{signupSeries.length > 0 ? '30' : '0'} ngày gần nhất</p>
            </div>
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <TrendingUp size={12} className="mr-1 inline" /> Tăng trưởng
            </div>
          </div>
          <div className="mt-4 h-72">
            {signupSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Cần backend /api/admin/stats</div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={signupSeries}>
                  <defs>
                    <linearGradient id="signupColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1677ff" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#1677ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" interval={2} />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" name="Đăng ký" stroke="#1677ff" strokeWidth={2} fill="url(#signupColor)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Phân bố giới tính</h2>
          <p className="text-xs text-slate-500">Toàn bộ người dùng</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={genderSeries} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {genderSeries.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2: Posts per day + Trending hashtags */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Bài đăng theo ngày</h2>
              <p className="text-xs text-slate-500">30 ngày gần nhất</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            {postsSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Cần backend /api/admin/stats</div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={postsSeries}>
                  <defs>
                    <linearGradient id="postsColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" interval={2} />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" name="Bài đăng" stroke="#10b981" strokeWidth={2} fill="url(#postsColor)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Hashtag thịnh hành</h2>
              <p className="text-xs text-slate-500">Số bài đăng theo hashtag</p>
            </div>
            <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Hash size={12} className="mr-1 inline" /> Trending
            </div>
          </div>
          <div className="mt-4 h-72">
            {trendingSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có dữ liệu hashtag.</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={trendingSeries} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                  <YAxis type="category" dataKey="tag" tick={{ fontSize: 12 }} stroke="#94a3b8" width={120} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="posts" name="Bài đăng" radius={[0, 6, 6, 0]}>
                    {trendingSeries.map((_, idx) => (
                      <Cell key={idx} fill={HASHTAG_COLORS[idx % HASHTAG_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Charts row 3: Page categories + Recent users */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Top danh mục Page</h2>
          <p className="text-xs text-slate-500">Theo số lượng trang</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={pageCategorySeries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} stroke="#94a3b8" width={80} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="Số trang" fill="#0958d9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Người dùng đăng ký gần đây</h2>
            <p className="text-xs text-slate-500">Theo dõi các tài khoản mới được tạo</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Người dùng</th>
                  <th className="px-4 py-3 text-left">Số điện thoại</th>
                  <th className="px-4 py-3 text-left">Ngày tạo</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentUsers.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Chưa có dữ liệu.</td></tr>
                ) : (
                  recentUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={buildS3Url(u.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${u.name || u.username || u.id}`} className="h-9 w-9 rounded-full object-cover" alt="" />
                          <div>
                            <p className="font-medium text-slate-800">{u.name || u.username || `User #${u.id}`}</p>
                            <p className="text-xs text-slate-500">@{u.username || '---'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                      <td className="px-4 py-3">
                        {u.locked ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Đang khoá</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Hoạt động</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Truy cập nhanh</h2>
        <p className="text-xs text-slate-500">Các tác vụ thường dùng</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Users, title: 'Người dùng', desc: 'Khoá, mở khoá, cập nhật', path: '/users' },
            { icon: Newspaper, title: 'Pages', desc: 'Quản lý trang & thành viên', path: '/pages' },
            { icon: FileText, title: 'Bài đăng', desc: 'Xem / xoá nội dung', path: '/posts' },
            { icon: BookImage, title: 'Stories', desc: 'Xem / xoá stories', path: '/stories' },
            { icon: Music2, title: 'Thư viện nhạc', desc: 'Duyệt kho nhạc', path: '/music' },
          ].map((q) => (
            <a key={q.title} href={q.path} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 hover:border-indigo-200 hover:shadow-sm transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <q.icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{q.title}</p>
                <p className="text-xs text-slate-500">{q.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
