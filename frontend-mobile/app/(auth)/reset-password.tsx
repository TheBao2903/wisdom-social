import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { resetPassword, forgotPassword } from '@/services/authService';
import Logo from '@/components/Logo';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { validateResetPasswordForm, validateOTP } from '@/utils/validators';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const phone = params.phone as string;

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendSuccess, setResendSuccess] = useState(false);
    const [lockCountdown, setLockCountdown] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRefs = useRef<Array<TextInput | null>>([]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startCountdown = useCallback((seconds: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setLockCountdown(seconds);
        timerRef.current = setInterval(() => {
            setLockCountdown((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const isLocked = lockCountdown > 0;

    const handleOtpChange = (value: string, index: number) => {
        if (value.length > 1) value = value[0];
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleResend = async () => {
        setResendLoading(true);
        setError('');
        setResendSuccess(false);
        try {
            const result = await forgotPassword(phone);
            if (result.success) {
                setResendSuccess(true);
            } else {
                setError(result.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
            }
        } catch {
            setError('Đã xảy ra lỗi, vui lòng thử lại.');
        } finally {
            setResendLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (isLocked) return;

        const otpCode = otp.join('');
        const otpValidation = validateOTP(otpCode);
        if (!otpValidation.isValid) {
            setError(otpValidation.error || '');
            return;
        }

        const validation = validateResetPasswordForm(password, confirmPassword);
        if (!validation.isValid) {
            setError(validation.error || '');
            return;
        }

        setError('');
        setLoading(true);
        try {
            const result = await resetPassword({
                phone,
                password,
                confirmPassword,
                confirmationCode: otpCode,
            });

            if (result.success) {
                router.replace('/(auth)/login');
            } else {
                if (result.remainingSeconds && result.remainingSeconds > 0) {
                    startCountdown(result.remainingSeconds);
                }
                setError(result.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
            }
        } catch {
            setError('Đã xảy ra lỗi, vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={['#EFF6FF', '#FFFFFF', '#F9FAFB']}
            style={styles.gradient}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.logoContainer}>
                        <Logo size="medium" showSubtitle={false} />
                    </View>

                    <View style={styles.iconContainer}>
                        <View style={styles.iconBackground}>
                            <Ionicons name="lock-closed" size={48} color="#3B82F6" />
                        </View>
                    </View>

                    <Text style={styles.title}>Reset Password 11</Text>
                    <Text style={styles.subtitle}>
                        Enter the OTP sent to{' '}
                        <Text style={styles.phoneHighlight}>{phone}</Text>
                        {' '}and your new password
                    </Text>

                    <View style={styles.otpContainer}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => { inputRefs.current[index] = ref; }}
                                style={styles.otpInput}
                                value={digit}
                                onChangeText={(value) => handleOtpChange(value, index)}
                                onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                            />
                        ))}
                    </View>

                    <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={resendLoading || loading}>
                        <Text style={styles.resendText}>
                            Chưa nhận được mã?{' '}
                            <Text style={styles.resendLink}>
                                {resendLoading ? 'Đang gửi...' : 'Gửi lại'}
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    {resendSuccess ? (
                        <Text style={styles.successText}>Mã OTP mới đã được gửi.</Text>
                    ) : null}

                    <View style={styles.form}>
                        <View style={styles.inputWrapper}>
                            <View style={styles.inputIconContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Mật khẩu mới"
                                placeholderTextColor="#9CA3AF"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye' : 'eye-off'}
                                    size={20}
                                    color="#9CA3AF"
                                />
                            </TouchableOpacity>
                        </View>

                        <PasswordStrengthMeter password={password} />

                        <View style={styles.inputWrapper}>
                            <View style={styles.inputIconContainer}>
                                <Ionicons name="shield-checkmark-outline" size={20} color="#9CA3AF" />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Xác nhận mật khẩu mới"
                                placeholderTextColor="#9CA3AF"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirmPassword}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                <Ionicons
                                    name={showConfirmPassword ? 'eye' : 'eye-off'}
                                    size={20}
                                    color="#9CA3AF"
                                />
                            </TouchableOpacity>
                        </View>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        {isLocked ? (
                            <Text style={styles.lockTimer}>
                                Thử lại sau {formatCountdown(lockCountdown)}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.submitButton, (loading || isLocked) && styles.disabledButton]}
                            onPress={handleResetPassword}
                            disabled={loading || isLocked}
                        >
                            <LinearGradient
                                colors={loading ? ['#93C5FD', '#93C5FD'] : ['#3B82F6', '#2563EB']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitButtonGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <View style={styles.buttonContent}>
                                        <Text style={styles.submitButtonText}>Đặt lại mật khẩu</Text>
                                        <Ionicons name="checkmark-done" size={20} color="#fff" />
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconBackground: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#1F2937',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    phoneHighlight: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    otpInput: {
        width: 50,
        height: 60,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        fontSize: 24,
        textAlign: 'center',
        fontWeight: '700',
        color: '#1F2937',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    resendButton: {
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 24,
    },
    resendText: {
        fontSize: 14,
        color: '#6B7280',
    },
    resendLink: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    successText: {
        color: '#10B981',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 8,
    },
    form: {
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    inputIconContainer: {
        paddingLeft: 16,
        paddingRight: 12,
    },
    input: {
        flex: 1,
        padding: 16,
        fontSize: 15,
        color: '#1F2937',
    },
    eyeIcon: {
        paddingHorizontal: 16,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        marginBottom: 12,
        marginTop: -4,
        textAlign: 'center',
    },
    lockTimer: {
        color: '#F59E0B',
        fontWeight: '600',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 12,
    },
    submitButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    disabledButton: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
