/**
 * Messaging Hooks
 *
 * Custom React hooks for managing messaging state and operations.
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {
    ChatMessage,
    DEFAULT_QUICK_RESPONSES,
    MessageContactOption,
    OtherMessagePartyType,
    QuickResponse,
    RecentConversation
} from "../components/dialogs/messaging-dialog/types";
import messagingApi from "../api/messagingApi";

export const conversationsQueryKey = ['messages', 'conversations'] as const;
export const CONVERSATIONS_REFRESH_MS = 20_000;
/** Shorter than the client-wide 30s so a stuck load turns into an error with Retry sooner. */
export const CONVERSATIONS_TIMEOUT_MS = 20_000;
export const SLOW_LOAD_HINT_MS = 8_000;

/**
 * The conversation list, fetched and polled only while the message center is open.
 * Closing it aborts an in-flight load; reopening shows the cached list while it refreshes.
 */
export function useConversations(open: boolean) {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: conversationsQueryKey,
        queryFn: ({signal}) => messagingApi.getRecentList({signal, timeout: CONVERSATIONS_TIMEOUT_MS}),
        enabled: open,
        refetchInterval: open ? CONVERSATIONS_REFRESH_MS : false,
        staleTime: 0,
        // The panel offers Retry; silent retries would only hold the spinner up longer.
        retry: false,
    });

    useEffect(() => {
        if (!open) void queryClient.cancelQueries({queryKey: conversationsQueryKey});
    }, [open, queryClient]);

    const isLoading = query.isPending && query.isFetching;
    const [isSlow, setIsSlow] = useState(false);
    useEffect(() => {
        if (!isLoading) {
            setIsSlow(false);
            return;
        }
        const timer = setTimeout(() => setIsSlow(true), SLOW_LOAD_HINT_MS);
        return () => clearTimeout(timer);
    }, [isLoading]);

    const {refetch} = query;
    // Joins an in-flight poll rather than cancelling it and starting over.
    const refresh = useCallback(() => refetch({cancelRefetch: false}), [refetch]);

    const setConversations = useCallback(async (
        update: (previous: RecentConversation[]) => RecentConversation[],
    ) => {
        // An in-flight poll would otherwise land afterwards and overwrite the local change.
        await queryClient.cancelQueries({queryKey: conversationsQueryKey});
        queryClient.setQueryData<RecentConversation[]>(conversationsQueryKey, previous => update(previous ?? []));
    }, [queryClient]);

    const updateConversation = useCallback((
        otherPartyId: number,
        otherPartyType: OtherMessagePartyType,
        updates: Partial<RecentConversation>
    ) => setConversations(previous => previous.map(conv =>
        conv.otherPartyId === otherPartyId && conv.otherPartyType === otherPartyType
            ? {...conv, ...updates}
            : conv
    )), [setConversations]);

    const addConversation = useCallback((conversation: RecentConversation) => setConversations(previous =>
        previous.some(c =>
            c.otherPartyId === conversation.otherPartyId && c.otherPartyType === conversation.otherPartyType)
            ? previous
            : [conversation, ...previous]
    ), [setConversations]);

    return {
        conversations: query.data ?? EMPTY_CONVERSATIONS,
        isLoading,
        isSlow,
        isRefreshing: query.isFetching,
        error: query.isError && query.data === undefined ? errorMessage(query.error) : null,
        refresh,
        updateConversation,
        addConversation,
    };
}

const EMPTY_CONVERSATIONS: RecentConversation[] = [];

function errorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }
    return 'Failed to load conversations';
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
