import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Newspaper,
  BookImage,
  Music2,
  ScrollText,
  Flag,
  Settings,
  Sparkles,
} from 'lucide-react';

const items = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Người dùng', icon: Users },
  { to: '/pages', label: 'Trang (Pages)', icon: Newspaper },
  { to: '/posts', label: 'Bài đăng', icon: FileText },
  { to: '/stories', label: 'Stories', icon: BookImage },
  { to: '/music', label: 'Thư viện nhạc', icon: Music2 },
  { to: '/reports', label: 'Báo cáo', icon: Flag },
  { to: '/activity-log', label: 'Nhật ký hoạt động', icon: ScrollText },
  { to: '/settings', label: 'Cấu hình', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow">
          <Sparkles size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Wisdom Social</p>
          <p className="text-xs text-slate-500">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Quản trị
        </p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={18}
                      className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Bảo mật cấp Admin</p>
          <p className="mt-1 leading-relaxed">
            Mọi hành động khoá / xoá đều được ghi log để truy vết.
          </p>
        </div>
      </div>
    </aside>
  );
}
