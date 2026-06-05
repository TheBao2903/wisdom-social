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
import { forgotPassword } from '@/services/authService';
import Logo from '@/components/Logo';
import { validatePhone } from '@/utils/validators';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        const validation = validatePhone(phone);
        if (!validation.isValid) {
            setError(validation.error || '');
            return;
        }

        setError('');
        setLoading(true);
        try {
            const result = await forgotPassword(phone);
            if (result.success) {
                router.push({
                    pathname: '/(auth)/reset-password',
                    params: { phone },
                });
            } else {
                setError(result.message || 'Không thể gửi OTP. Vui lòng thử lại.');
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
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Logo showSubtitle />

                    <View style={styles.iconContainer}>
                        <View style={styles.iconBackground}>
                            <Ionicons name="key-outline" size={48} color="#3B82F6" />
                        </View>
                    </View>

                    <Text style={styles.title}>Forgot Password?</Text>

                    <Text style={styles.description}>
                        Don't worry! Enter your phone number and we'll send you an OTP code to reset your password.
                    </Text>

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

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[styles.submitButton, loading && styles.disabledButton]}
                        onPress={handleSubmit}
                        disabled={loading}
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
                                    <Text style={styles.submitButtonText}>Confirm</Text>
                                    <Ionicons name="send" size={20} color="#fff" />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <Link href="/(auth)/login" asChild>
                        <TouchableOpacity style={styles.backButton}>
                            <Ionicons name="arrow-back" size={18} color="#3B82F6" />
                            <Text style={styles.backButtonText}>Back to Login</Text>
                        </TouchableOpacity>
                    </Link>
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
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
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
    description: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 16,
        lineHeight: 22,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 24,
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
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    submitButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 20,
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
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        gap: 8,
    },
    backButtonText: {
        color: '#3B82F6',
        fontSize: 15,
        fontWeight: '600',
    },
});
