import {act, renderHook} from '@testing-library/react';
import {useMessagingDialog} from './useMessagingDialog';
import {toastService} from '../services/toastService';

vi.mock('../services/toastService', () => ({
    toastService: {showSuccessToast: vi.fn(), showErrorToast: vi.fn(), showInfoToast: vi.fn()},
}));

describe('useMessagingDialog', () => {
    beforeEach(() => vi.clearAllMocks());

    it('refreshes the unread count after the dialog closes', async () => {
        const order: string[] = [];
        const open = vi.fn().mockImplementation(async () => {
            order.push('open');
        });
        const refresh = vi.fn().mockImplementation(() => {
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
        const refresh = vi.fn();
        const {result} = renderHook(() => useMessagingDialog({refreshUnreadCount: refresh, openDialog: () => Promise.reject(new Error('bundle missing'))}));

        await act(() => result.current.openMessaging());
        expect(toastService.showErrorToast).toHaveBeenCalledWith('Messaging dialog is not loaded.');
        expect(refresh).not.toHaveBeenCalled();
    });
});
