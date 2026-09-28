/**
 * Messaging Hooks Tests
 */

import {act, renderHook, waitFor} from '@testing-library/react';
import {useAutoRefresh, useContactSearch, useConversations, useMessages, useQuickResponses,} from './useMessaging';
import messagingApi from "../services/messagingApi";
import {DEFAULT_QUICK_RESPONSES, OtherMessagePartyType} from "../components/dialogs/messaging-dialog/types";

// Mock the messagingApi
jest.mock('../services/messagingApi', () => {
    const methods = {
        getRecentList: jest.fn(),
        getMessages: jest.fn(),
        getQuickResponses: jest.fn(),
        addQuickResponse: jest.fn(),
        deleteQuickResponse: jest.fn(),
        getMessageContactOptions: jest.fn(),
    };
    return {
        __esModule: true,
        default: methods,
        messagingApi: methods,
    };
});

const mockMessagingApi = messagingApi as jest.Mocked<typeof messagingApi>;

describe('useConversations', () => {
    const mockConversations = [
        {
            otherPartyId: 1,
            otherPartyType: OtherMessagePartyType.Courier,
            otherPartyName: 'John Doe',
            otherPartyInitials: 'JD',
            otherPartyStatus: 'online',
            unreadCount: 3,
            lastMessage: 'Hello',
            lastMessageTime: '2024-01-15T10:00:00Z',
        },
        {
            otherPartyId: 2,
            otherPartyType: OtherMessagePartyType.Staff,
            otherPartyName: 'Jane Smith',
            otherPartyInitials: 'JS',
            otherPartyStatus: 'offline',
            unreadCount: 0,
            lastMessage: 'Thanks',
            lastMessageTime: '2024-01-15T09:00:00Z',
        },
    ];

    it('should initialize with empty conversations', () => {
        const { result } = renderHook(() => useConversations());

        expect(result.current.conversations).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should load conversations successfully', async () => {
        mockMessagingApi.getRecentList.mockResolvedValueOnce(mockConversations);

        const { result } = renderHook(() => useConversations());

        await act(async () => {
            await result.current.loadConversations();
        });

        expect(result.current.conversations).toEqual(mockConversations);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should handle loading errors', async () => {
        const error = new Error('Network error');
        mockMessagingApi.getRecentList.mockRejectedValueOnce(error);

        const { result } = renderHook(() => useConversations());

        await act(async () => {
            await result.current.loadConversations();
        });

        expect(result.current.conversations).toEqual([]);
        expect(result.current.error).toBe('Network error');
    });

    it('should load silently without showing loading state', async () => {
        mockMessagingApi.getRecentList.mockResolvedValueOnce(mockConversations);

        const { result } = renderHook(() => useConversations());

        let loadingDuringCall = false;
        await act(async () => {
            const promise = result.current.loadConversations(true);
            loadingDuringCall = result.current.isLoading;
            await promise;
        });

        expect(loadingDuringCall).toBe(false);
        expect(result.current.conversations).toEqual(mockConversations);
    });

    it('should update a conversation', async () => {
        mockMessagingApi.getRecentList.mockResolvedValueOnce(mockConversations);

        const { result } = renderHook(() => useConversations());

        await act(async () => {
            await result.current.loadConversations();
        });

        act(() => {
            result.current.updateConversation(1, OtherMessagePartyType.Courier, {
                unreadCount: 0,
                lastMessage: 'Updated message',
            });
        });

        expect(result.current.conversations[0].unreadCount).toBe(0);
        expect(result.current.conversations[0].lastMessage).toBe('Updated message');
    });

    it('should add a new conversation', () => {
        const { result } = renderHook(() => useConversations());

        const newConversation = {
            otherPartyId: 3,
            otherPartyType: OtherMessagePartyType.Courier,
            otherPartyName: 'New Driver',
            otherPartyInitials: 'ND',
            otherPartyStatus: 'online',
            unreadCount: 0,
            lastMessage: '',
            lastMessageTime: '2024-01-15T11:00:00Z',
        };

        act(() => {
            result.current.addConversation(newConversation);
        });

        expect(result.current.conversations).toHaveLength(1);
        expect(result.current.conversations[0]).toEqual(newConversation);
    });

    it('should not add duplicate conversation', async () => {
        mockMessagingApi.getRecentList.mockResolvedValueOnce(mockConversations);

        const { result } = renderHook(() => useConversations());

        await act(async () => {
            await result.current.loadConversations();
        });

        act(() => {
            result.current.addConversation(mockConversations[0]);
        });

        expect(result.current.conversations).toHaveLength(2);
    });
});

describe('useMessages', () => {
    const mockMessages = [
        {
            messageId: 2,
            sendFromStaffId: 100,
            sendToCourierId: 200,
            message: 'Second message',
            messageTime: '2024-01-15T10:05:00Z',
            read: true,
            sent: true,
            isSender: true,
        },
        {
            messageId: 1,
            sendFromCourierId: 200,
            sendToStaffId: 100,
            message: 'First message',
            messageTime: '2024-01-15T10:00:00Z',
            read: true,
            sent: true,
            isSender: false,
        },
    ];

    it('should initialize with empty messages', () => {
        const { result } = renderHook(() => useMessages(100));

        expect(result.current.messages).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should load and sort messages by time', async () => {
        mockMessagingApi.getMessages.mockResolvedValueOnce(mockMessages);

        const { result } = renderHook(() => useMessages(100));

        await act(async () => {
            await result.current.loadMessages(200, OtherMessagePartyType.Courier);
        });

        expect(mockMessagingApi.getMessages).toHaveBeenCalledWith(200, OtherMessagePartyType.Courier, 100);
        // Messages should be sorted oldest first
        expect(result.current.messages[0].messageId).toBe(1);
        expect(result.current.messages[1].messageId).toBe(2);
    });

    it('should order messages with an identical time by messageId', async () => {
        // Same timestamp must resolve deterministically to received (id) order,
        // so a re-fetch can never re-shuffle same-second messages.
        const sameTimeMessages = [
            {...mockMessages[0], messageId: 3, messageTime: '2024-01-15T10:00:00Z'},
            {...mockMessages[1], messageId: 1, messageTime: '2024-01-15T10:00:00Z'},
            {...mockMessages[0], messageId: 2, messageTime: '2024-01-15T10:00:00Z'},
        ];
        mockMessagingApi.getMessages.mockResolvedValueOnce(sameTimeMessages);

        const { result } = renderHook(() => useMessages(100));

        await act(async () => {
            await result.current.loadMessages(200, OtherMessagePartyType.Courier);
        });

        expect(result.current.messages.map(m => m.messageId)).toEqual([1, 2, 3]);
    });

    it('should handle loading errors', async () => {
        const error = new Error('Failed to load');
        mockMessagingApi.getMessages.mockRejectedValueOnce(error);

        const { result } = renderHook(() => useMessages(100));

        await act(async () => {
            await result.current.loadMessages(200, OtherMessagePartyType.Courier);
        });

        expect(result.current.error).toBe('Failed to load');
    });

    it('should add optimistic message', () => {
        const { result } = renderHook(() => useMessages(100));

        const newMessage = {
            messageId: -1,
            sendFromStaffId: 100,
            sendToCourierId: 200,
            message: 'New message',
            messageTime: '2024-01-15T10:10:00Z',
            read: false,
            sent: true,
            isSender: true,
        };

        act(() => {
            result.current.addOptimisticMessage(newMessage);
        });

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]).toEqual(newMessage);
    });

    it('should clear messages', async () => {
        mockMessagingApi.getMessages.mockResolvedValueOnce(mockMessages);

        const { result } = renderHook(() => useMessages(100));

        await act(async () => {
            await result.current.loadMessages(200, OtherMessagePartyType.Courier);
        });

        expect(result.current.messages).toHaveLength(2);

        act(() => {
            result.current.clearMessages();
        });

        expect(result.current.messages).toEqual([]);
    });
});

describe('useQuickResponses', () => {
    it('should initialize with default quick responses', () => {
        const { result } = renderHook(() => useQuickResponses());

        expect(result.current.quickResponses).toEqual(DEFAULT_QUICK_RESPONSES);
        expect(result.current.isLoading).toBe(false);
    });

    it('should load and combine saved responses with defaults', async () => {
        const savedResponses = [
            { id: 1, text: 'Custom response' },
            { id: 2, text: 'Another custom' },
        ];
        mockMessagingApi.getQuickResponses.mockResolvedValueOnce(savedResponses);

        const { result } = renderHook(() => useQuickResponses());

        await act(async () => {
            await result.current.loadQuickResponses();
        });

        // Saved responses should be first, then defaults
        expect(result.current.quickResponses.slice(0, 2)).toEqual(savedResponses);
        expect(result.current.quickResponses.slice(2)).toEqual(DEFAULT_QUICK_RESPONSES);
    });

    it('should fallback to defaults on error', async () => {
        mockMessagingApi.getQuickResponses.mockRejectedValueOnce(new Error('Failed'));

        const { result } = renderHook(() => useQuickResponses());

        await act(async () => {
            await result.current.loadQuickResponses();
        });

        expect(result.current.quickResponses).toEqual(DEFAULT_QUICK_RESPONSES);
    });

    it('should add a new quick response', async () => {
        mockMessagingApi.addQuickResponse.mockResolvedValueOnce(99);

        const { result } = renderHook(() => useQuickResponses());

        let success = false;
        await act(async () => {
            success = await result.current.addQuickResponse('New quick response');
        });

        expect(success).toBe(true);
        expect(result.current.quickResponses[0]).toEqual({ id: 99, text: 'New quick response' });
    });

    it('should return false when add fails', async () => {
        mockMessagingApi.addQuickResponse.mockRejectedValueOnce(new Error('Failed'));

        const { result } = renderHook(() => useQuickResponses());

        let success = true;
        await act(async () => {
            success = await result.current.addQuickResponse('Failed response');
        });

        expect(success).toBe(false);
    });

    it('should delete a quick response', async () => {
        const savedResponses = [{ id: 1, text: 'To delete' }];
        mockMessagingApi.getQuickResponses.mockResolvedValueOnce(savedResponses);
        mockMessagingApi.deleteQuickResponse.mockResolvedValueOnce(undefined);

        const { result } = renderHook(() => useQuickResponses());

        await act(async () => {
            await result.current.loadQuickResponses();
        });

        const initialLength = result.current.quickResponses.length;

        let success = false;
        await act(async () => {
            success = await result.current.deleteQuickResponse(1);
        });

        expect(success).toBe(true);
        expect(result.current.quickResponses).toHaveLength(initialLength - 1);
        expect(result.current.quickResponses.find(r => r.id === 1)).toBeUndefined();
    });

    it('should not delete default responses (negative IDs)', async () => {
        const { result } = renderHook(() => useQuickResponses());

        let success = true;
        await act(async () => {
            success = await result.current.deleteQuickResponse(-1);
        });

        expect(success).toBe(false);
        expect(mockMessagingApi.deleteQuickResponse).not.toHaveBeenCalled();
    });
});

describe('useContactSearch', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const mockContacts = [
        {
            id: 'courier-1',
            recordId: 1,
            name: 'John Driver',
            otherMessagePartyType: OtherMessagePartyType.Courier,
            status: 'online',
        },
    ];

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useContactSearch());

        expect(result.current.searchTerm).toBe('');
        expect(result.current.results).toEqual([]);
        expect(result.current.isSearching).toBe(false);
    });

    it('should clear results for empty search term', async () => {
        const { result } = renderHook(() => useContactSearch());

        await act(async () => {
            await result.current.search('');
        });

        expect(result.current.results).toEqual([]);
        expect(result.current.isSearching).toBe(false);
    });

    it('should debounce search and return results', async () => {
        mockMessagingApi.getMessageContactOptions.mockResolvedValueOnce(mockContacts);

        const { result } = renderHook(() => useContactSearch());

        await act(async () => {
            await result.current.search('john');
        });

        expect(result.current.searchTerm).toBe('john');
        expect(mockMessagingApi.getMessageContactOptions).not.toHaveBeenCalled();

        // Fast-forward debounce timer
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(mockMessagingApi.getMessageContactOptions).toHaveBeenCalledWith('john');
        });
    });

    it('should clear search', async () => {
        const { result } = renderHook(() => useContactSearch());

        await act(async () => {
            await result.current.search('test');
        });

        act(() => {
            result.current.clearSearch();
        });

        expect(result.current.searchTerm).toBe('');
        expect(result.current.results).toEqual([]);
    });
});

describe('useAutoRefresh', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should call callback at specified interval when enabled', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);

        renderHook(() => useAutoRefresh(callback, 1000, true));

        expect(callback).not.toHaveBeenCalled();

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        expect(callback).toHaveBeenCalledTimes(1);

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not call callback when disabled', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);

        renderHook(() => useAutoRefresh(callback, 1000, false));

        await act(async () => {
            jest.advanceTimersByTime(3000);
        });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should stop calling when disabled after being enabled', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);

        const { rerender } = renderHook(
            ({ enabled }) => useAutoRefresh(callback, 1000, enabled),
            { initialProps: { enabled: true } }
        );

        await act(async () => {
            jest.advanceTimersByTime(1000);
        });

        expect(callback).toHaveBeenCalledTimes(1);

        rerender({ enabled: false });

        await act(async () => {
            jest.advanceTimersByTime(2000);
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should provide manual trigger function', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);

        const { result } = renderHook(() => useAutoRefresh(callback, 10000, true));

        await act(async () => {
            await result.current.trigger();
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should cleanup interval on unmount', () => {
        const callback = jest.fn().mockResolvedValue(undefined);

        const { unmount } = renderHook(() => useAutoRefresh(callback, 1000, true));

        unmount();

        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(callback).not.toHaveBeenCalled();
    });
});
