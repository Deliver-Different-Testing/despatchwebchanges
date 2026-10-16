import {act, renderHook} from '@testing-library/react';
import {useMessagingDialog} from './useMessagingDialog';
import {toastService} from '../services/toastService';

jest.mock('../services/toastService', () => ({
    toastService: {showSuccessToast: jest.fn(), showErrorToast: jest.fn(), showInfoToast: jest.fn()},
}));

describe('useMessagingDialog', () => {
    beforeEach(() => jest.clearAllMocks());

    it('refreshes the unread count after the dialog closes', async () => {
        const order: string[] = [];
        const open = jest.fn().mockImplementation(async () => {
            order.push('open');
        });
        const refresh = jest.fn().mockImplementation(() => {
            order.push('refresh');
        });
        const {result} = renderHook(() => useMessagingDialog({
            refreshUnreadCount: refresh,
            openDialog: async () => ({open}) as never,
        }));

        await act(() => result.current.openMessaging());
        expect(order).toEqual(['open', 'refresh']);
    });

    it('toasts and skips the refresh when the bundle is missing', async () => {
        const refresh = jest.fn();
        const {result} = renderHook(() => useMessagingDialog({refreshUnreadCount: refresh, openDialog: () => Promise.reject(new Error('bundle missing'))}));

        await act(() => result.current.openMessaging());
        expect(toastService.showErrorToast).toHaveBeenCalledWith('Messaging dialog is not loaded.');
        expect(refresh).not.toHaveBeenCalled();
    });
});
