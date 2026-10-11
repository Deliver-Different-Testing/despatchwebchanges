import {useCallback} from 'react';
import {getDialog, requireDialog, type DialogOpener} from '../dialogs/dialogRegistry';

export interface UseMessagingDialogOptions {
    refreshUnreadCount: () => void | Promise<void>;
    openDialog?: DialogOpener;
}

export function useMessagingDialog(
    {refreshUnreadCount, openDialog = getDialog}: UseMessagingDialogOptions,
): {openMessaging: () => Promise<void>} {
    const openMessaging = useCallback(async () => {
        const dialog = requireDialog(openDialog, 'ReactMessagingDialog');
        if (!dialog) return;
        try {
            await dialog.open();
            // Reading messages in the dialog changes the badge.
            await refreshUnreadCount();
        } catch (err) {
            console.error('[messaging] dialog error', err);
        }
    }, [openDialog, refreshUnreadCount]);

    return {openMessaging};
}
