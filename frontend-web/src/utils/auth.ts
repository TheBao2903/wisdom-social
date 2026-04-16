import { getCookie, setCookie, clearAuthStorage } from './cookies';
import type  { UserRequestLogin, UserRequestRegister, UserRequestForgotPassword, UserRequestResetPassword } from '../services/userService';
import userService from '../services/userService';

const AUTH_KEY = 'authed';
const USER_KEY = 'current_user';
const ACCESS_TOKEN_KEY = 'accessToken';

// Callback để thông báo khi auth state thay đổi
let authChangeCallback: (() => void) | null = null;

const mapResetPasswordError = (rawMessage?: string) => {
    const message = rawMessage || '';
    const lower = message.toLowerCase();

    if (lower.includes('invalid code provided')) {
        return 'Mã OTP không đúng. Vui lòng kiểm tra lại OTP mới nhất.';
    }

    if (lower.includes('expired') || lower.includes('codeexpired')) {
        return 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại OTP.';
    }

    return 'Cập nhật mật khẩu thất bại. Vui lòng thử lại.';
};

const mapRegisterOtpError = (rawMessage?: string) => {
    const message = rawMessage || '';
    const lower = message.toLowerCase();

    if (lower.includes('invalid verification code') || lower.includes('codemismatch')) {
        return 'Mã OTP không hợp lệ. Vui lòng kiểm tra và thử lại.';
    }

    if (lower.includes('expired') || lower.includes('codeexpired')) {
        return 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại OTP.';
    }

    return 'Xác nhận OTP thất bại. Vui lòng thử lại.';
};

const mapLoginError = (rawMessage?: string) => {
    const message = rawMessage || '';
    const lower = message.toLowerCase();

    if (lower.includes('notauthorizedexception') || lower.includes('incorrect username or password')) {
        return 'Tên đăng nhập hoặc mật khẩu không đúng.';
    }

    return 'Đăng nhập thất bại. Vui lòng thử lại.';
};

const mapRegisterError = (rawMessage?: string) => {
    const message = rawMessage || '';
    const lower = message.toLowerCase();

    if (
        lower.includes('user already exists') ||
        lower.includes('usernameexistsexception') ||
        lower.includes('already exists')
    ) {
        return 'Số điện thoại đã được đăng ký. Vui lòng dùng số khác hoặc đăng nhập.';
    }

    return 'Đăng ký thất bại. Vui lòng thử lại.';
};

export const setAuthChangeCallback = (callback: () => void) => {
    authChangeCallback = callback;
};

// Initialize auth - axios will automatically send cookies with withCredentials: true
export const initializeAuth = () => {
    const token = getCookie(ACCESS_TOKEN_KEY);
    if (token) {
        console.log('Auth initialized with token from cookie');
    }
};

export const register = async (phone: string, password: string, confirmPassword: string): Promise<boolean> => {
    try {
        const data: UserRequestRegister = {
            phone,
            password,
            confirmPassword,
        };
        const response = await userService.register(data);

        console.log('Registration successful:', response);
        return true;
    } catch (error: any) {
        console.error('Register error:', error);
        if (error.response?.data?.message) {
            throw new Error(mapRegisterError(error.response.data.message));
        }
        if (error.message) {
            throw new Error(mapRegisterError(error.message));
        }
        throw new Error(mapRegisterError());
    }
};

export const confirmRegister = async (phone: string, otp: string): Promise<boolean> => {
    try {
        await userService.confirmRegister({ phone, otp });
        return true;
    } catch (error: any) {
        console.error('Confirm register error:', error);
        if (error.response?.data?.message) {
            throw new Error(mapRegisterOtpError(error.response.data.message));
        }
        throw new Error(mapRegisterOtpError(error.message));
    }
};



export const login = async (phone: string, password: string): Promise<boolean> => {
    try {
        const data: UserRequestLogin = {
            phone,
            password
        };

        const userData = await userService.login(data);

        console.log('Login response:', userData);

        if (!userData) {
            throw new Error('Số điện thoại hoặc mật khẩu không chính xác.');
        }

        // Note: userService.login() already stores tokens to cookies only (not localStorage)
        // userService handles accessToken and refreshToken storage
        localStorage.setItem('type', 'normal');
        localStorage.setItem(AUTH_KEY, 'true');

        const currentUser = await userService.getCurrentUser();
        if (currentUser) {
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        }

        console.log('Login successful, tokens stored');
        if (authChangeCallback) {
            authChangeCallback();
        }
        return true;
    } catch (error: any) {
        console.error('Login error:', error);
        if (error.response?.data?.message) {
            throw new Error(mapLoginError(error.response.data.message));
        }
        if (error.message) {
            throw new Error(mapLoginError(error.message));
        }
        throw new Error(mapLoginError());
    }
};

export const getToken = (): string | null => {
    return getCookie(ACCESS_TOKEN_KEY);
};

export const logout = async (): Promise<void> => {
    // Clear client data immediately so redirect/navigation cannot interrupt cleanup.
    clearAuthStorage();

    try {
        // Call logout API
        await userService.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }

    // Trigger callback để cập nhật AuthContext
    if (authChangeCallback) {
        authChangeCallback();
    }
};

export const forgotPassword = async (phone: string): Promise<boolean> => {
    try {
        const data: UserRequestForgotPassword = { phone };
        const response = await userService.forgotPassword(data);

        if (!response) {
            throw new Error('Gửi OTP thất bại');
        }

        return true;
    } catch (error: any) {
        console.error('Forgot password error:', error);
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }
        throw new Error('Gửi OTP thất bại. Vui lòng thử lại.');
    }
};

export const resetPassword = async (
    phone: string,
    otp: string,
    password: string,
    confirmPassword: string
): Promise<boolean> => {
    try {
        const data: UserRequestResetPassword = {
            phone,
            password,
            confirmPassword,
            confirmationCode: otp,
            instant: new Date().toISOString(),
        };
        const response = await userService.resetPassword(data);

        if (!response) {
            throw new Error('Cập nhật mật khẩu thất bại');
        }

        console.log('Password reset successful');
        return true;
    } catch (error: any) {
        console.error('Reset password error:', error);
        if (error.response?.data?.message) {
            throw new Error(mapResetPasswordError(error.response.data.message));
        }
        throw new Error(mapResetPasswordError(error.message));
    }
};

export const refreshTokenAsync = async (): Promise<string> => {
    try {
        const authType = localStorage.getItem('type');
        const token = authType === 'qr'
            ? await userService.refreshQrToken()
            : await userService.refreshToken();
        if (token) {
            setCookie(ACCESS_TOKEN_KEY, token, 7);
            return token;
        }
        throw new Error('Refresh token failed');
    } catch (error) {
        console.error('Refresh token error:', error);
        throw error;
    }
};

export const isAuthenticated = (): boolean => {
    const hasToken = getCookie(ACCESS_TOKEN_KEY) !== null;
    return hasToken;
};

export const getCurrentUser = async () => {
    try {
        const user = await userService.getCurrentUser();
        console.log('getCurrentUser:', user);
        return user;
    } catch (error) {
        console.error('Get current user error:', error);
        // Fallback to localStorage if API fails
        const userStr = localStorage.getItem(USER_KEY);
        const user = userStr ? JSON.parse(userStr) : null;
        return user;
    }
};
