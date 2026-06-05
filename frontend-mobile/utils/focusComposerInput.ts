import type { RefObject } from "react";
import type { TextInput } from "react-native";

interface FocusComposerInputOptions {
    delayMs?: number;
}

export function focusComposerInput(
    messageInputRef: RefObject<TextInput | null>,
    options?: FocusComposerInputOptions,
): void {
    const delayMs = options?.delayMs ?? 0;

    const focusNow = () => {
        messageInputRef.current?.focus();
    };

    const focusWithFrames = () => {
        requestAnimationFrame(() => {
            focusNow();
            requestAnimationFrame(() => {
                focusNow();
            });
        });
    };

    if (delayMs > 0) {
        setTimeout(() => {
            focusWithFrames();
        }, delayMs);
        return;
    }

    focusWithFrames();
}
