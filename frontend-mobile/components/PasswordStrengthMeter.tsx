import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPasswordStrength, PasswordStrengthLevel } from '@/utils/validators';

interface PasswordStrengthMeterProps {
    password: string;
    /** Hiển thị danh sách yêu cầu chi tiết. Mặc định: true */
    showChecklist?: boolean;
}

const LEVEL_CONFIG: Record<
    PasswordStrengthLevel,
    { bars: number; color: string }
> = {
    empty: { bars: 0, color: '#E5E7EB' },
    weak: { bars: 1, color: '#EF4444' },
    medium: { bars: 2, color: '#F59E0B' },
    strong: { bars: 3, color: '#84CC16' },
    'very-strong': { bars: 4, color: '#22C55E' },
};

const CHECK_ITEMS: {
    key: keyof ReturnType<typeof getPasswordStrength>['checks'];
    label: string;
}[] = [
    { key: 'length', label: 'Ít nhất 8 ký tự' },
    { key: 'lowercase', label: '1 chữ thường (a-z)' },
    { key: 'uppercase', label: '1 chữ hoa (A-Z)' },
    { key: 'number', label: '1 chữ số (0-9)' },
    { key: 'special', label: '1 ký tự đặc biệt (!@#...)' },
];

export default function PasswordStrengthMeter({
    password,
    showChecklist = true,
}: PasswordStrengthMeterProps) {
    if (!password) return null;

    const strength = getPasswordStrength(password);
    const config = LEVEL_CONFIG[strength.level];

    return (
        <View style={styles.container}>
            {/* Thanh đo độ mạnh */}
            <View style={styles.barRow}>
                <View style={styles.bars}>
                    {[0, 1, 2, 3].map((i) => (
                        <View
                            key={i}
                            style={[
                                styles.bar,
                                {
                                    backgroundColor:
                                        i < config.bars ? config.color : '#E5E7EB',
                                },
                            ]}
                        />
                    ))}
                </View>
                {strength.label ? (
                    <Text style={[styles.label, { color: config.color }]}>
                        {strength.label}
                    </Text>
                ) : null}
            </View>

            {/* Danh sách yêu cầu */}
            {showChecklist ? (
                <View style={styles.checklist}>
                    {CHECK_ITEMS.map(({ key, label }) => {
                        const ok = strength.checks[key];
                        return (
                            <View key={key} style={styles.checkItem}>
                                <Ionicons
                                    name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={14}
                                    color={ok ? '#22C55E' : '#9CA3AF'}
                                />
                                <Text
                                    style={[
                                        styles.checkLabel,
                                        { color: ok ? '#16A34A' : '#9CA3AF' },
                                    ]}
                                >
                                    {label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: -4,
        marginBottom: 16,
        paddingHorizontal: 4,
        gap: 8,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bars: {
        flex: 1,
        flexDirection: 'row',
        gap: 4,
    },
    bar: {
        flex: 1,
        height: 5,
        borderRadius: 999,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        minWidth: 64,
        textAlign: 'right',
    },
    checklist: {
        gap: 4,
    },
    checkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    checkLabel: {
        fontSize: 12,
    },
});
