/**
 * Dispatch Page Context
 *
 * Provides shared state between all dispatch dashboard widgets.
 * Cross-cutting state that multiple widgets need access to.
 */

import React, {createContext, useContext} from 'react';
import type {ShowToastFn} from '../../services/toastService';
import type {BoxState, DispatchBox, ILayout} from './DispatchPage.interfaces';
import type {DispatchJob} from '../../interfaces/dispatchJob';

export interface DispatchContextValue {
    // Config
    isUsCustomer: boolean;
    showToast: ShowToastFn;

    // Layout
    layouts: ILayout[];
    currentLayoutName: string;
    boxStates: Record<string, BoxState>;
    isDefaultLayout: boolean;
    refreshBox: (boxId: DispatchBox) => void;

    // Job selection
    currentJobId: number | null;
    currentJob: DispatchJob | null;
    selectJob: (job: DispatchJob | null) => void;
    selectJobById: (jobId: number | null) => void;

    // Subtitle text for widget headers
    currentSelection: string;
    currentWorkSelection: string;
}

const DispatchContext = createContext<DispatchContextValue | null>(null);

export function useDispatchContext(): DispatchContextValue {
    const ctx = useContext(DispatchContext);
    if (!ctx) {
        throw new Error('useDispatchContext must be used within DispatchProvider');
    }
    return ctx;
}

export const DispatchProvider = DispatchContext.Provider;
