import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Phone, ShieldCheck } from 'lucide-react';
import authService from '../services/authService';
import { saveAccessToken } from '../api/axiosClient';
import { useAuth, hasAdminRole } from '../context/AuthContext';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshMe, logout } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) {
      toast.error('Vui lòng nhập số điện thoại và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.login({ phone: phone.trim(), password });
      const data = res?.data ?? res;
      const token = data?.accessToken || data?.token;
      if (!token) {
        toast.error('Không nhận được access token từ máy chủ');
        return;
      }
      saveAccessToken(token);
      const me = await refreshMe();
      if (!hasAdminRole(me)) {
        // Tài khoản USER thường không được phép vào trang quản trị.
        await logout();
        toast.error('Tài khoản này không có quyền truy cập trang quản trị');
        return;
      }
      toast.success('Đăng nhập thành công');
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Đăng nhập thất bại';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-indigo-200/40 lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 to-purple-700 p-10 text-white lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <ShieldCheck size={22} />
              </div>
              <span className="text-lg font-semibold">Wisdom Social Admin</span>
            </div>
            <h1 className="mt-12 text-3xl font-bold leading-tight">
              Bảng điều khiển dành cho quản trị viên
            </h1>
            <p className="mt-4 text-indigo-100">
              Quản lý người dùng, trang, bài đăng và theo dõi sức khoẻ hệ thống tập trung tại một nơi.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-indigo-100">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Theo dõi thống kê hoạt động theo thời gian thực
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Khoá / mở khoá tài khoản vi phạm
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Kiểm duyệt nội dung trang & bài đăng
            </li>
          </ul>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-slate-900">Đăng nhập Admin</h2>
          <p className="mt-1 text-sm text-slate-500">
            Vui lòng đăng nhập bằng tài khoản quản trị để tiếp tục.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700">Số điện thoại</label>
              <div className="relative mt-1.5">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Mật khẩu</label>
              <div className="relative mt-1.5">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Wisdom Social. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
