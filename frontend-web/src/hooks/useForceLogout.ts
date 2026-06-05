import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import websocketService from '../services/websocket';
import { clearAuthStorage } from '../utils/cookies';
import { convertPhoneToInternational } from './useCurrentUser';

/**
 * useForceLogout
 *
 * Hook lắng nghe WebSocket event FORCE_LOGOUT từ backend.
 * Khi admin khóa tài khoản (hoặc bất kỳ thiết bị nào gọi logoutAllDevices),
 * backend sẽ push event tới HAI topic:
 *   - /topic/user/{userId}/force-logout  (kênh chính, luôn tồn tại)
 *   - /topic/user/{phone}/force-logout   (tương thích ngược)
 * Hook này subscribe cả hai để đảm bảo nhận được dù phone null/lệch định dạng,
 * rồi:
 * 1. Xóa toàn bộ auth data khỏi cookie & localStorage
 * 2. Disconnect WebSocket
 * 3. Redirect ngay về /login
 *
 * @param phone - Số điện thoại của user đang đăng nhập (format 0xxx hoặc +84xxx)
 * @param userId - ID của user đang đăng nhập (kênh đáng tin cậy nhất)
 */
export function useForceLogout(phone: string | undefined, userId: number | undefined) {
    const navigate = useNavigate();
    const subscribedRef = useRef(false);

    const doForceLogout = useCallback(() => {
        // 1. Clear auth data immediately
        clearAuthStorage();
        // 2. Disconnect WebSocket
        websocketService.disconnect();
        subscribedRef.current = false;
        // 3. Redirect to login
        navigate('/login', { replace: true });
    }, [navigate]);

    // Force-logout chung (admin khóa / logout-all / đổi mật khẩu): đăng xuất im lặng.
    const handleForceLogout = useCallback(() => {
        console.log('🔴 FORCE LOGOUT: đăng xuất tất cả thiết bị. Đang đăng xuất...');
        doForceLogout();
    }, [doForceLogout]);

    // Bị đá do có phiên cùng nền tảng đăng nhập ở nơi khác -> báo cho người dùng.
    const handleForceLogoutElsewhere = useCallback(() => {
        console.log('🔴 FORCE LOGOUT: tài khoản đăng nhập ở nơi khác. Đang đăng xuất...');
        toast.error('Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác', {
            duration: 6000,
        });
        doForceLogout();
    }, [doForceLogout]);

    useEffect(() => {
        const internationalPhone = phone ? convertPhoneToInternational(phone) : '';
        const hasPhone = !!internationalPhone;
        const hasUserId = typeof userId === 'number';

        // Không có định danh nào để subscribe -> bỏ qua.
        if (!hasPhone && !hasUserId) return;

        const setup = async () => {
            // Đăng ký subscription TRƯỚC (an toàn kể cả khi chưa connected): factory
            // được lưu lại và syncSubscriptions sẽ tự subscribe ngay khi WS kết nối.
            if (hasUserId) {
                websocketService.subscribeToForceLogoutById(userId!, handleForceLogout);
                // Topic riêng theo nền tảng: bị đá khi có phiên WEB khác đăng nhập -> có thông báo.
                websocketService.subscribeToForceLogoutByPlatform(userId!, "WEB", handleForceLogoutElsewhere);
            }
            if (hasPhone) {
                websocketService.subscribeToForceLogout(internationalPhone, handleForceLogout);
            }
            subscribedRef.current = true;
            console.log(`🔒 useForceLogout: registered (userId=${userId ?? '-'}, phone=${internationalPhone || '-'})`);

            try {
                // Đảm bảo WS được kết nối (nếu chưa) để kích hoạt subscribe ngay.
                if (!websocketService.isConnected()) {
                    await websocketService.connect();
                }
            } catch (error) {
                console.error('❌ useForceLogout: connect error (subscription vẫn được giữ, sẽ tự subscribe khi reconnect)', error);
            }
        };

        setup();

        return () => {
            if (subscribedRef.current) {
                if (hasUserId) {
                    websocketService.unsubscribeFromForceLogoutById(userId!);
                    websocketService.unsubscribeFromForceLogoutByPlatform(userId!, "WEB");
                }
                if (hasPhone) {
                    websocketService.unsubscribeFromForceLogout(internationalPhone);
                }
                subscribedRef.current = false;
            }
        };
    }, [phone, userId, handleForceLogout, handleForceLogoutElsewhere]);
}
