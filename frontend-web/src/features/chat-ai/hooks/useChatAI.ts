import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import chatAIService from "../services/chatAIService";
import type { MessagePreviewDTO } from "../types/chatAI";

interface UseChatAIOptions {
    conversationId: number;
}

interface ParsedAIError {
    status?: number;
    code?: string;
    message: string;
}

function parseAIError(error: unknown): ParsedAIError {
    if (isAxiosError(error)) {
        const status = error.response?.status;
        const payload = error.response?.data as
            | {
                message?: string;
                errors?: { code?: string; message?: string };
            }
            | undefined;

        return {
            status,
            code: payload?.errors?.code,
            message:
                payload?.message ||
                payload?.errors?.message ||
                "Không thể xử lý yêu cầu AI lúc này",
        };
    }

    if (error instanceof Error) {
        return { message: error.message };
    }

    return { message: "Không thể xử lý yêu cầu AI lúc này" };
}

export function useChatAI({ conversationId }: UseChatAIOptions) {
    const [consentStatus, setConsentStatus] = useState<boolean | null>(null);
    const [consentLoading, setConsentLoading] = useState(false);
    const [consentModalOpen, setConsentModalOpen] = useState(false);

    const [summary, setSummary] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const fetchConsentStatus = useCallback(async (): Promise<boolean> => {
        setConsentLoading(true);
        try {
            const response = await chatAIService.getConsentStatus();
            const confirmed = response.confirmUseAI;
            setConsentStatus(confirmed);
            return confirmed;
        } catch (error) {
            const parsedError = parseAIError(error);
            setAiError(parsedError.message);
            setConsentStatus(false);
            return false;
        } finally {
            setConsentLoading(false);
        }
    }, []);

    useEffect(() => {
        setSummary(null);
        setSuggestions([]);
        setAiError(null);
        void fetchConsentStatus();
    }, [conversationId, fetchConsentStatus]);

    const handleConsentRequired = useCallback(() => {
        setConsentStatus(false);
        setConsentModalOpen(true);
    }, []);

    const ensureCanUseAI = useCallback(async (): Promise<boolean> => {
        if (consentStatus === true) {
            return true;
        }

        const latestConsentStatus = await fetchConsentStatus();
        if (!latestConsentStatus) {
            setConsentModalOpen(true);
            return false;
        }

        return true;
    }, [consentStatus, fetchConsentStatus]);

    const acceptAIConsent = useCallback(async () => {
        setConsentLoading(true);
        setAiError(null);
        try {
            const response = await chatAIService.updateConsentStatus({
                confirmUseAI: true,
            });
            setConsentStatus(response.confirmUseAI);
            setConsentModalOpen(false);
        } catch (error) {
            const parsedError = parseAIError(error);
            setAiError(parsedError.message);
        } finally {
            setConsentLoading(false);
        }
    }, []);

    const declineAIConsent = useCallback(() => {
        setConsentStatus(false);
        setConsentModalOpen(false);
    }, []);

    const summarizeConversation = useCallback(async (currentMessages?: MessagePreviewDTO[]) => {
        setAiError(null);

        const allowed = await ensureCanUseAI();
        if (!allowed) {
            return;
        }

        setIsSummarizing(true);
        try {
            const sanitizedMessages = (currentMessages ?? []).filter(
                (message) => Boolean(message?.content?.trim()),
            );

            const summarizePayload = sanitizedMessages.length > 0
                ? {
                    conversationId,
                    messages: sanitizedMessages,
                }
                : {
                    conversationId,
                    limit: 30,
                };

            const response = await chatAIService.summarizeConversation(summarizePayload);
            setSummary(response.summary);
        } catch (error) {
            const parsedError = parseAIError(error);
            setAiError(parsedError.message);

            if (
                parsedError.status === 403 &&
                parsedError.code === "AI_CONSENT_REQUIRED"
            ) {
                handleConsentRequired();
            }
        } finally {
            setIsSummarizing(false);
        }
    }, [conversationId, ensureCanUseAI, handleConsentRequired]);

    const suggestReplies = useCallback(async () => {
        setAiError(null);

        const allowed = await ensureCanUseAI();
        if (!allowed) {
            return;
        }

        setIsSuggesting(true);
        try {
            const response = await chatAIService.suggestReplies({
                conversationId,
                limit: 30,
                suggestionCount: 3,
            });
            setSuggestions(response.suggestions);
        } catch (error) {
            const parsedError = parseAIError(error);
            setAiError(parsedError.message);

            if (
                parsedError.status === 403 &&
                parsedError.code === "AI_CONSENT_REQUIRED"
            ) {
                handleConsentRequired();
            }
        } finally {
            setIsSuggesting(false);
        }
    }, [conversationId, ensureCanUseAI, handleConsentRequired]);

    return {
        consentStatus,
        consentLoading,
        consentModalOpen,
        summary,
        suggestions,
        aiError,
        isSummarizing,
        isSuggesting,

        openConsentModal: () => setConsentModalOpen(true),
        closeConsentModal: () => setConsentModalOpen(false),
        acceptAIConsent,
        declineAIConsent,

        summarizeConversation,
        suggestReplies,
        setSummary,
        setSuggestions,
    };
}
