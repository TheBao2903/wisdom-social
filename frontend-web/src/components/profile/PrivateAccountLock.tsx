import { Lock } from "lucide-react";

export default function PrivateAccountLock() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 rounded-full border-2 border-gray-900 dark:border-white flex items-center justify-center mb-5">
        <Lock size={40} strokeWidth={1.5} className="text-gray-900 dark:text-white" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Tài khoản này ở chế độ riêng tư
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
        Chỉ những người theo dõi mới xem được ảnh và video của họ.
      </p>
    </div>
  );
}
