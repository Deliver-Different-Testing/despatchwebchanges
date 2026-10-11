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
            openDialog: () => ({open}) as never,
        }));

        await act(() => result.current.openMessaging());
        expect(order).toEqual(['open', 'refresh']);
    });

    it('toasts and skips the refresh when the bundle is missing', async () => {
        const refresh = jest.fn();
        const {result} = renderHook(() => useMessagingDialog({refreshUnreadCount: refresh, openDialog: () => undefined}));

        await act(() => result.current.openMessaging());
        expect(toastService.showErrorToast).toHaveBeenCalledWith('Messaging dialog is not loaded.');
        expect(refresh).not.toHaveBeenCalled();
    });

    it('falls back to the window global via the default registry', async () => {
        const open = jest.fn().mockResolvedValue(undefined);
        (window as unknown as {ReactMessagingDialog?: unknown}).ReactMessagingDialog = {open};
        const refresh = jest.fn();
        const {result} = renderHook(() => useMessagingDialog({refreshUnreadCount: refresh}));

        await act(() => result.current.openMessaging());
        delete (window as unknown as {ReactMessagingDialog?: unknown}).ReactMessagingDialog;
        expect(open).toHaveBeenCalled();
        expect(refresh).toHaveBeenCalled();
    });
});
