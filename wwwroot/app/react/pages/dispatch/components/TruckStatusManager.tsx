/**
 * TruckStatusManager - Self-contained truck loading status dialog.
 *
 * Owns the dialog open/data/refreshing state so DispatchPage doesn't
 * re-render when truck status is fetched or refreshed.
 */

import React, {forwardRef, useCallback, useImperativeHandle, useState} from 'react';
import {getTruckCourierStatus} from '../../../services/dispatchApi';
import type {ITruckCourierStatus} from '../../../services/dispatchApi';
import type {ShowToastFn} from '../../../services/toastService';
import {TruckCourierStatusDialog} from './TruckCourierStatusDialog';

export interface TruckStatusManagerHandle {
    show: (courierId: number) => void;
}

interface TruckStatusManagerProps {
    isUsCustomer: boolean;
    showToast: ShowToastFn;
}

export const TruckStatusManager = forwardRef<TruckStatusManagerHandle, TruckStatusManagerProps>(
    function TruckStatusManager({isUsCustomer, showToast}, ref) {
        const [state, setState] = useState<{open: boolean; data: ITruckCourierStatus | null; isRefreshing: boolean}>({
            open: false, data: null, isRefreshing: false,
        });

        useImperativeHandle(ref, () => ({
            show: async (courierId: number) => {
                try {
                    const status = await getTruckCourierStatus(courierId);
                    setState({open: true, data: status, isRefreshing: false});
                } catch (error) {
                    console.error('Error fetching truck status:', error);
                    showToast('Error loading truck status', 'error');
                }
            },
        }));

        const handleRefresh = useCallback(async () => {
            const courierId = state.data?.courierId;
            if (!courierId) return;
            setState(prev => ({...prev, isRefreshing: true}));
            try {
                const status = await getTruckCourierStatus(courierId);
                setState({open: true, data: status, isRefreshing: false});
            } catch (error) {
                console.error('Error refreshing truck status:', error);
                showToast('Error refreshing truck status', 'error');
                setState(prev => ({...prev, isRefreshing: false}));
            }
        }, [state.data?.courierId, showToast]);

        return (
            <TruckCourierStatusDialog
                open={state.open}
                onClose={() => setState(prev => ({...prev, open: false}))}
                truckCourierStatus={state.data}
                isUsCustomer={isUsCustomer}
                onRefresh={handleRefresh}
                isRefreshing={state.isRefreshing}
            />
        );
    }
);
