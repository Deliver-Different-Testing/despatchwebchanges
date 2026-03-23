/**
 * useMessaging Hook
 *
 * Manages messaging state (unread count) and opens the messaging dialog.
 */

import {useCallback} from 'react';
import {useQuery} from '@tanstack/react-query';
import {queryKeys} from '../../../query/queryClient';
import {getUnreadMessageCount} from '../../../services/dispatchApi';
import {openMessagingDialog} from '../../../components/dialogs/messaging-dialog';
import type {ShowToastFn} from '../../../services/toastService';

export interface UseMessagingReturn {
    unreadCount: number;
    openMessages: () => void;
}

export function useMessaging(showToast: ShowToastFn): UseMessagingReturn {
    const {data} = useQuery({
        queryKey: queryKeys.dispatch.unreadMessages,
        queryFn: () => getUnreadMessageCount(),
        refetchInterval: 60000,
    });

    const openMessages = useCallback(() => {
        openMessagingDialog({toastService: {showToast}});
    }, [showToast]);

    return {unreadCount: data ?? 0, openMessages};
}
