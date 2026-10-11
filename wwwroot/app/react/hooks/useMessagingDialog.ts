import {useCallback} from 'react';
import {loadDialog, requireDialog, type DialogLoader} from '../dialogs/dialogRegistry';

export interface UseMessagingDialogOptions {
    refreshUnreadCount: () => void | Promise<void>;
    openDialog?: DialogLoader;
}

export function useMessagingDialog(
    {refreshUnreadCount, openDialog = loadDialog}: UseMessagingDialogOptions,
): {openMessaging: () => Promise<void>} {
    const openMessaging = useCallback(async () => {
        const dialog = await requireDialog('Messaging', openDialog);
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
