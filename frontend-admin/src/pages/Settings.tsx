import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cấu hình</h1>
        <p className="text-sm text-slate-500">Thông tin về tài khoản admin và môi trường vận hành.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Tài khoản đang đăng nhập</h2>
          <dl className="mt-4 grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-slate-500">Họ tên</dt>
            <dd className="col-span-2 text-slate-800">{user?.name || '—'}</dd>
            <dt className="text-slate-500">Username</dt>
            <dd className="col-span-2 text-slate-800">@{user?.username || '—'}</dd>
            <dt className="text-slate-500">Số điện thoại</dt>
            <dd className="col-span-2 text-slate-800">{user?.phone || '—'}</dd>
            <dt className="text-slate-500">Ngày tạo</dt>
            <dd className="col-span-2 text-slate-800">
              {user?.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : '—'}
            </dd>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Môi trường</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-500">API Base URL</span>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">/api</code>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Backend Spring Boot</span>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">localhost:8080</code>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Auth method</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Cookie + Bearer
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">UI</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                React 19 + Tailwind 4
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
