import { Check, X } from "lucide-react";
import { getPasswordStrength } from "../../utils/validation";

interface PasswordStrengthMeterProps {
    password: string;
    /** Hiển thị danh sách các yêu cầu chi tiết. Mặc định: true */
    showChecklist?: boolean;
}

const LEVEL_CONFIG = {
    empty: { bars: 0, color: "bg-gray-200", text: "text-gray-400" },
    weak: { bars: 1, color: "bg-red-500", text: "text-red-500" },
    medium: { bars: 2, color: "bg-amber-500", text: "text-amber-500" },
    strong: { bars: 3, color: "bg-lime-500", text: "text-lime-600" },
    "very-strong": { bars: 4, color: "bg-green-500", text: "text-green-600" },
} as const;

const CHECK_ITEMS: { key: keyof ReturnType<typeof getPasswordStrength>["checks"]; label: string }[] = [
    { key: "length", label: "Ít nhất 8 ký tự" },
    { key: "lowercase", label: "1 chữ thường (a-z)" },
    { key: "uppercase", label: "1 chữ hoa (A-Z)" },
    { key: "number", label: "1 chữ số (0-9)" },
    { key: "special", label: "1 ký tự đặc biệt (!@#...)" },
];

export default function PasswordStrengthMeter({
    password,
    showChecklist = true,
}: PasswordStrengthMeterProps) {
    if (!password) return null;

    const strength = getPasswordStrength(password);
    const config = LEVEL_CONFIG[strength.level];

    return (
        <div className="space-y-2 px-1">
            {/* Thanh đo độ mạnh */}
            <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                i < config.bars ? config.color : "bg-gray-200"
                            }`}
                        />
                    ))}
                </div>
                {strength.label && (
                    <span className={`text-xs font-semibold ${config.text}`}>
                        {strength.label}
                    </span>
                )}
            </div>

            {/* Danh sách yêu cầu */}
            {showChecklist && (
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {CHECK_ITEMS.map(({ key, label }) => {
                        const ok = strength.checks[key];
                        return (
                            <li
                                key={key}
                                className={`flex items-center gap-1.5 text-xs ${
                                    ok ? "text-green-600" : "text-gray-400"
                                }`}
                            >
                                {ok ? (
                                    <Check className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                    <X className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{label}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
