import { Globe, Lock, Users } from "lucide-react";
import type { PrivacyType } from "../../../types";

interface PrivacyDisplay {
    icon: typeof Globe;
    text: string;
    color: string;
}

export const getPrivacyDisplay = (
    privacy?: PrivacyType,
    isOwnPost: boolean = false
): PrivacyDisplay => {
    if (isOwnPost) {
        switch (privacy) {
            case "PUBLIC":
                return { icon: Globe, text: "Public", color: "text-blue-500" };
            case "FRIENDS":
                return { icon: Users, text: "Friends", color: "text-green-500" };
            case "SPECIFIC":
                return {
                    icon: Users,
                    text: "Specific friends",
                    color: "text-purple-500",
                };
            case "EXCEPT":
                return {
                    icon: Users,
                    text: "Friends except",
                    color: "text-orange-500",
                };
            case "ONLY_ME":
                return { icon: Lock, text: "Only me", color: "text-gray-500" };
            default:
                return { icon: Globe, text: "Public", color: "text-blue-500" };
        }
    }

    switch (privacy) {
        case "PUBLIC":
            return { icon: Globe, text: "Public", color: "text-blue-500" };
        case "FRIENDS":
        case "SPECIFIC":
        case "EXCEPT":
            return { icon: Users, text: "Friends", color: "text-green-500" };
        default:
            return { icon: Globe, text: "Public", color: "text-blue-500" };
    }
};

export type { PrivacyDisplay };
