import { Settings, Shield, Bell, Lock, HelpCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "../utils/auth";

export default function SettingsPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const settingsOptions = [
    {
      icon: Settings,
      title: "Chỉnh sửa hồ sơ",
      description: "Tên, tiểu sử, ảnh đại diện",
      action: "Chỉnh sửa",
      onClick: () => navigate("/edit-profile"),
    },
    {
      icon: Shield,
      title: "Quyền riêng tư & Bảo mật",
      description: "Quyền riêng tư tài khoản, tài khoản đã chặn",
      action: "Quản lý",
      onClick: () => navigate("/blocked-users"),
    },
    {
      icon: Bell,
      title: "Thông báo",
      description: "Thông báo đẩy, email, SMS",
      action: "Cài đặt",
    },
    {
      icon: Lock,
      title: "Mật khẩu",
      description: "Thay đổi mật khẩu của bạn",
      action: "Cập nhật",
    },
    {
      icon: HelpCircle,
      title: "Trợ giúp",
      description: "Hỗ trợ và câu hỏi thường gặp",
      action: "Xem",
    },
    {
      icon: Info,
      title: "Giới thiệu",
      description: "Phiên bản ứng dụng và điều khoản",
      action: "Xem",
    },
  ];

  return (
    <div className="max-w-[600px] mx-auto">
      <div className="bg-white dark:bg-[#000]">
        <div className="py-8">
          <h1 className="text-2xl font-bold mb-2 dark:text-white">Cài đặt</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Quản lý cài đặt tài khoản và tùy chọn của bạn
          </p>
        </div>

        {/* Nội dung cài đặt tài khoản */}
        <div className="space-y-1">
          {settingsOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <div
                key={index}
                onClick={option.onClick}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-[#262626]"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 dark:bg-[#262626] rounded-full">
                    <Icon
                      size={20}
                      className="text-gray-700 dark:text-gray-300"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold dark:text-white">
                      {option.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </div>
                </div>
                <button className="text-sm font-semibold text-[#0095f6] hover:text-[#00376b] dark:hover:text-[#0095f6]">
                  {option.action}
                </button>
              </div>
            );
          })}
        </div>

        {/* Nút đăng xuất */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#262626]">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}