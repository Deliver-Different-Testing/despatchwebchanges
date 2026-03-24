/** @jest-environment jest-environment-jsdom */
/**
 * useMessaging Hook Tests
 */

import {renderHook, waitFor} from '@testing-library/react';
import {useMessaging} from './useMessaging';
import {createTestQueryClient, createWrapper} from '../../../__testUtils__';

// Mock API modules
jest.mock('../../../services/dispatchApi', () => ({
    getUnreadMessageCount: jest.fn(),
}));

jest.mock('../../../components/dialogs/messaging-dialog', () => ({
    openMessagingDialog: jest.fn(),
}));

import {getUnreadMessageCount} from '../../../services/dispatchApi';
import {openMessagingDialog} from '../../../components/dialogs/messaging-dialog';

const mockGetUnreadMessageCount = getUnreadMessageCount as jest.MockedFunction<typeof getUnreadMessageCount>;
const mockOpenMessagingDialog = openMessagingDialog as jest.MockedFunction<typeof openMessagingDialog>;

const mockShowToast = jest.fn();

describe('useMessaging', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGetUnreadMessageCount.mockResolvedValue(0);
    });

    it('returns 0 unreadCount initially', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useMessaging(mockShowToast), {wrapper});

        expect(result.current.unreadCount).toBe(0);
    });

    it('fetches unread message count', async () => {
        mockGetUnreadMessageCount.mockResolvedValue(5);

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useMessaging(mockShowToast), {wrapper});

        await waitFor(() => {
            expect(result.current.unreadCount).toBe(5);
        });
        expect(mockGetUnreadMessageCount).toHaveBeenCalled();
    });

    it('openMessages calls openMessagingDialog with showToast', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useMessaging(mockShowToast), {wrapper});

        result.current.openMessages();

        expect(mockOpenMessagingDialog).toHaveBeenCalledWith({
            toastService: {showToast: mockShowToast},
        });
    });
});
