/**
 * Messaging Hooks
 *
 * Custom React hooks for managing messaging state and operations.
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import {
    ChatMessage,
    DEFAULT_QUICK_RESPONSES,
    MessageContactOption,
    OtherMessagePartyType,
    QuickResponse,
    RecentConversation
} from "../components/dialogs/messaging-dialog/types";
import messagingApi from "../services/messagingApi";

/**
 * Hook for managing the conversation list
 */
export function useConversations() {
    const [conversations, setConversations] = useState<RecentConversation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadConversations = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        setError(null);

        try {
            const data = await messagingApi.getRecentList();
            setConversations(data);
        } catch (err: unknown) {
            console.error('Failed to load conversations:', err);
            if (!silent) setError(err instanceof Error ? err.message : 'Failed to load conversations');
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    const updateConversation = useCallback((
        otherPartyId: number,
        otherPartyType: OtherMessagePartyType,
        updates: Partial<RecentConversation>
    ) => {
        setConversations(prev => prev.map(conv =>
            conv.otherPartyId === otherPartyId && conv.otherPartyType === otherPartyType
                ? { ...conv, ...updates }
                : conv
        ));
    }, []);

    const addConversation = useCallback((conversation: RecentConversation) => {
        setConversations(prev => {
            const exists = prev.some(
                c => c.otherPartyId === conversation.otherPartyId &&
                     c.otherPartyType === conversation.otherPartyType
            );
            if (exists) return prev;
            return [conversation, ...prev];
        });
    }, []);

    return {
        conversations,
        isLoading,
        error,
        loadConversations,
        updateConversation,
        addConversation,
    };
}

/**
 * Hook for managing messages in a conversation
 */
export function useMessages(currentStaffId: number) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadMessages = useCallback(async (
        otherPartyId: number,
        otherPartyType: OtherMessagePartyType,
        silent = false
    ) => {
        if (!silent) setIsLoading(true);
        setError(null);

        try {
            const data = await messagingApi.getMessages(otherPartyId, otherPartyType, currentStaffId);
            // Sort by time, tie-breaking on messageId (received order) so a
            // re-fetch can never re-shuffle messages that share a timestamp.
            const sorted = [...data].sort((a, b) => {
                const diff = new Date(a.messageTime).getTime() - new Date(b.messageTime).getTime();
                return diff !== 0 ? diff : a.messageId - b.messageId;
            });
            setMessages(sorted);
        } catch (err: unknown) {
            console.error('Failed to load messages:', err);
            if (!silent) setError(err instanceof Error ? err.message : 'Failed to load messages');
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [currentStaffId]);

    const addOptimisticMessage = useCallback((message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
    }, []);

    const updateMessage = useCallback((messageId: number, updates: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(m =>
            m.messageId === messageId ? {...m, ...updates} : m
        ));
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return {
        messages,
        isLoading,
        error,
        loadMessages,
        addOptimisticMessage,
        updateMessage,
        clearMessages,
    };
}

/**
 * Hook for managing quick responses
 */
export function useQuickResponses() {
    const [quickResponses, setQuickResponses] = useState<QuickResponse[]>(DEFAULT_QUICK_RESPONSES);
    const [isLoading, setIsLoading] = useState(false);

    const loadQuickResponses = useCallback(async () => {
        setIsLoading(true);
        try {
            const savedResponses = await messagingApi.getQuickResponses();
            // Combine saved responses with defaults, saved first
            setQuickResponses([...savedResponses, ...DEFAULT_QUICK_RESPONSES]);
        } catch (err) {
            console.error('Failed to load quick responses:', err);
            // Fallback to defaults on error
            setQuickResponses([...DEFAULT_QUICK_RESPONSES]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addQuickResponse = useCallback(async (text: string): Promise<boolean> => {
        try {
            const newId = await messagingApi.addQuickResponse({ message: text });
            const newResponse: QuickResponse = { id: newId, text };
            setQuickResponses(prev => [newResponse, ...prev]);
            return true;
        } catch (err) {
            console.error('Failed to add quick response:', err);
            return false;
        }
    }, []);

    const deleteQuickResponse = useCallback(async (id: number): Promise<boolean> => {
        // Don't allow deleting default responses (negative IDs)
        if (id < 0) return false;

        try {
            await messagingApi.deleteQuickResponse(id);
            setQuickResponses(prev => prev.filter(r => r.id !== id));
            return true;
        } catch (err) {
            console.error('Failed to delete quick response:', err);
            return false;
        }
    }, []);

    return {
        quickResponses,
        isLoading,
        loadQuickResponses,
        addQuickResponse,
        deleteQuickResponse,
    };
}

/**
 * Hook for contact search
 */
export function useContactSearch() {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<MessageContactOption[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const search = useCallback(async (term: string) => {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        setSearchTerm(term);

        if (!term.trim()) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        // Debounce search
        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const data = await messagingApi.getMessageContactOptions(term);
                setResults(data);
            } catch (err) {
                console.error('Search failed:', err);
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    }, []);

    const clearSearch = useCallback(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        setSearchTerm('');
        setResults([]);
        setIsSearching(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    return {
        searchTerm,
        results,
        isSearching,
        search,
        clearSearch,
    };
}

/**
 * Hook for auto-refresh functionality
 */
export function useAutoRefresh(
    callback: () => Promise<void>,
    intervalMs: number,
    enabled: boolean = true
) {
    const savedCallback = useRef(callback);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval
    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            savedCallback.current();
        }, intervalMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [intervalMs, enabled]);

    // Manual trigger
    const trigger = useCallback(async () => {
        await savedCallback.current();
    }, []);

    return { trigger };
}
