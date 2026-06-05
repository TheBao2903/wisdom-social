import React, { useState } from 'react';
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
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { registerWithPhone } from '@/services/authService';
import Logo from '@/components/Logo';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { validateSignupForm } from '@/utils/validators';

export default function SignUpScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignUp = async () => {
        const validation = validateSignupForm(phone, password, confirmPassword);
        if (!validation.isValid) {
            setError(validation.error || '');
            return;
        }

        setError('');
        setLoading(true);
        try {
            const result = await registerWithPhone({ phone, password, confirmPassword });
            if (result.success) {
                router.push({
                    pathname: '/(auth)/verify-otp',
                    params: { phone, type: 'register' },
                });
            } else {
                setError(result.message || 'Đăng ký thất bại');
            }
        } catch {
            setError('Có lỗi xảy ra, vui lòng thử lại');
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
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Logo showSubtitle />

                    <Text style={styles.welcomeText}>
                        Create Account
                    </Text>
                    <Text style={styles.subtitle}>
                        Sign up with your phone number to get started
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.inputWrapper}>
                            <View style={styles.inputIconContainer}>
                                <Ionicons name="call-outline" size={20} color="#3B82F6" />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Phone Number"
                                placeholderTextColor="#9CA3AF"
                                value={phone}
                                onChangeText={setPhone}
                                autoCapitalize="none"
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputWrapper}>
                            <View style={styles.inputIconContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color="#3B82F6" />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
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
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>
                        </View>

                        <PasswordStrengthMeter password={password} />

                        <View style={styles.inputWrapper}>
                            <View style={styles.inputIconContainer}>
                                <Ionicons name="shield-checkmark-outline" size={20} color="#3B82F6" />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
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
                                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>
                        </View>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <TouchableOpacity
                            style={[styles.signUpButton, loading && styles.disabledButton]}
                            onPress={handleSignUp}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={loading ? ['#93C5FD', '#93C5FD'] : ['#3B82F6', '#2563EB']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.signUpButtonGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <View style={styles.buttonContent}>
                                        <Text style={styles.signUpButtonText}>Sign Up</Text>
                                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.terms}>
                        By signing up, you agree to our{' '}
                        <Text style={styles.termsLink}>Terms</Text>,{' '}
                        <Text style={styles.termsLink}>Privacy Policy</Text> and{' '}
                        <Text style={styles.termsLink}>Cookies Policy</Text>.
                    </Text>

                    <View style={styles.loginContainer}>
                        <Text style={styles.loginText}>Already have an account? </Text>
                        <Link href="/(auth)/login" asChild>
                            <TouchableOpacity>
                                <Text style={styles.loginLink}>Log in</Text>
                            </TouchableOpacity>
                        </Link>
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
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        paddingTop: 60,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#1F2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 24,
    },
    form: {
        marginBottom: 24,
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
        paddingRight: 16,
        paddingLeft: 12,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        marginBottom: 12,
        marginTop: -4,
    },
    signUpButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    signUpButtonGradient: {
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
    signUpButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    terms: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 24,
        paddingHorizontal: 16,
        lineHeight: 18,
    },
    termsLink: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    loginText: {
        color: '#6B7280',
        fontSize: 15,
    },
    loginLink: {
        color: '#3B82F6',
        fontSize: 15,
        fontWeight: '700',
    },
});
