/**
 * useAiAssistant Hook
 *
 * Manages AI assistant conversation state, streaming, and abort control.
 */

import { useState, useCallback, useRef } from 'react';
import { AiMessage } from './types';
import { streamChat, AiChatMessage } from '../../../services/aiAssistantApi';

/** Must match AiInputGuard.cs constants */
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONVERSATION_MESSAGES = 40;

let nextMessageId = 1;

function generateId(): string {
    return `msg-${nextMessageId++}-${Date.now()}`;
}

export interface UseAiAssistantReturn {
    messages: AiMessage[];
    isLoading: boolean;
    sendMessage: (content: string) => Promise<void>;
    clearConversation: () => void;
    cancelResponse: () => void;
}

export function useAiAssistant(): UseAiAssistantReturn {
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const sendMessage = useCallback(async (content: string) => {
        const trimmed = content.trim();
        if (!trimmed || isLoading) return;

        // Frontend guardrails (backend also enforces these)
        if (trimmed.length > MAX_MESSAGE_LENGTH) return;
        if (messages.length >= MAX_CONVERSATION_MESSAGES) return;

        // Add user message
        const userMessage: AiMessage = {
            id: generateId(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
        };

        // Create placeholder for assistant response
        const assistantMessageId = generateId();
        const assistantMessage: AiMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsLoading(true);

        // Build conversation history for API
        const conversationHistory: AiChatMessage[] = [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user' as const, content: content.trim() },
        ];

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const chunks = streamChat(
                { messages: conversationHistory },
                abortController.signal
            );

            for await (const chunk of chunks) {
                if (chunk.isComplete) break;

                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantMessageId
                            ? { ...m, content: m.content + chunk.text }
                            : m
                    )
                );
            }

            // Mark streaming as complete
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantMessageId
                        ? { ...m, isStreaming: false }
                        : m
                )
            );
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                // User canceled - mark the message as complete with whatever we have
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantMessageId
                            ? {
                                  ...m,
                                  isStreaming: false,
                                  content: m.content || '(Response cancelled)',
                              }
                            : m
                    )
                );
            } else {
                const errorMessage =
                    error instanceof Error ? error.message : 'An unexpected error occurred';

                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantMessageId
                            ? {
                                  ...m,
                                  isStreaming: false,
                                  content: `Error: ${errorMessage}`,
                              }
                            : m
                    )
                );
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [messages, isLoading]);

    const clearConversation = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setMessages([]);
        setIsLoading(false);
    }, []);

    const cancelResponse = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        clearConversation,
        cancelResponse,
    };
}
