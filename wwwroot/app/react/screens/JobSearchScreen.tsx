import React, {useCallback, useMemo, useRef, useState} from 'react';
import {AppPage} from '../../enums/app-pages.enum';
import {PageFrame} from '../app/PageFrame';
import {ErrorBoundary} from '../components/common/error-boundary';
import type {LayoutStorageKeys} from '../components/common/box-shell/layoutPersistence';
import type {ToolbarActionsConfig} from '../components/common/app-shell/ToolbarActionsView';
import {useCustomizePanelsDialog} from '../hooks/useCustomizePanelsDialog';
import {useLayoutToolbar} from '../hooks/useLayoutToolbar';
import {useResetLayout} from '../hooks/useResetLayout';
import {createDefaultJobSearchLayout, createJobSearchBoxes} from '../pages/job-search/lib/boxDefinitions';
import type {JobSearchLayoutBridge} from '../pages/job-search/JobSearchLayoutBridge';
import {JobSearchPage} from '../pages/job-search/JobSearchPage';
import {toastService} from '../services/toastService';
import {getSession} from '../session';
import type {LayoutToolbarBridge} from '../utils/layoutToolbarActions';
import {showPageToast} from './pageToasts';

export interface JobSearchScreenProps {
    /** Deep-link job to open; the route (`/jobSearch/:jobId`) supplies it. */
    jobId?: number;
}

interface CreateJobDialogGlobal {
    open: (isUsTenant?: boolean) => Promise<number | null>;
}

export const JobSearchScreen: React.FC<JobSearchScreenProps> = ({jobId}) => {
    const session = getSession();
    const {contactId} = session;
    const isUsCustomer = session.isUsCustomer ?? false;

    const storageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutsCSV2-${contactId}`,
        lastActiveLayoutKey: `lastActiveLayoutCSV2-${contactId}`,
        boxVisibilityKeyBase: `boxVisibilityV2-${AppPage.JobSearch}-${contactId}`,
    }), [contactId]);
    const defaultLayout = useMemo(() => createDefaultJobSearchLayout(), []);

    const pageBridge = useRef<JobSearchLayoutBridge | null>(null);
    const [columnEditMode, setColumnEditModeState] = useState(false);

    const setColumnEditMode = useCallback((enabled: boolean) => {
        setColumnEditModeState(enabled);
        pageBridge.current?.setColumnEditMode(enabled);
    }, []);

    const getBridge = useCallback((): LayoutToolbarBridge | undefined => {
        const bridge = pageBridge.current;
        if (!bridge) return undefined;
        return {
            setCurrentLayoutName: bridge.setCurrentLayoutName,
            reloadLayoutsFromStorage: bridge.reloadFromStorage,
            promptSaveLayout: bridge.promptSaveLayout,
            promptDeleteLayout: bridge.promptDeleteLayout,
            promptRenameLayout: bridge.promptRenameLayout,
            importLegacyLayouts: bridge.importLegacyLayouts,
        };
    }, []);

    const layoutToolbar = useLayoutToolbar({getBridge, storageKeys, defaultLayout});

    const {resetLayout} = useResetLayout({
        currentLayoutName: layoutToolbar.currentLayoutName,
        resetCurrentLayout: () => pageBridge.current?.resetCurrentLayout(),
    });

    const {openCustomizePanels} = useCustomizePanelsDialog({
        storageKeys,
        createBoxes: createJobSearchBoxes,
        currentLayoutName: layoutToolbar.currentLayoutName,
        onVisibilityChanged: () => pageBridge.current?.reloadFromStorage(),
    });

    const createNewJob = useCallback(() => {
        const dialog = (window as unknown as {ReactCreateJobDialog?: CreateJobDialogGlobal}).ReactCreateJobDialog;
        if (!dialog) {
            toastService.showErrorToast('Create job dialog is not loaded.');
            return;
        }
        dialog.open(isUsCustomer)
            .then(newJobId => {
                if (newJobId) pageBridge.current?.jobCreated(newJobId);
            })
            .catch(err => console.error('[jobSearch] create job dialog error', err));
    }, [isUsCustomer]);

    const interCourierCharge = useCallback(() => {
        const bridge = pageBridge.current;
        if (!bridge) {
            toastService.showErrorToast('Inter-courier dialog is not loaded.');
            return;
        }
        bridge.openInterCourierCharge().catch(err => console.error('[jobSearch] inter-courier dialog error', err));
    }, []);

    const handleBridgeReady = useCallback((bridge: JobSearchLayoutBridge) => {
        pageBridge.current = bridge;
    }, []);

    const handleExitColumnEditMode = useCallback(() => setColumnEditMode(false), [setColumnEditMode]);

    const toolbarActions: ToolbarActionsConfig = {
        layouts: {
            items: layoutToolbar.layouts,
            currentLayoutName: layoutToolbar.currentLayoutName,
            onSaveLayout: () => void layoutToolbar.saveLayout(),
            onLoadLayout: layoutToolbar.loadLayout,
            onDeleteLayout: (index) => void layoutToolbar.deleteLayout(index),
            onRenameLayout: (index) => void layoutToolbar.renameLayout(index),
            onImportLayouts: layoutToolbar.importLayouts,
            onCustomizePanels: () => void openCustomizePanels(),
            onResetLayout: resetLayout,
            columnEditMode,
            onToggleColumnEditMode: () => setColumnEditMode(!columnEditMode),
        },
        actionsMenu: {onCreateNewJob: createNewJob, onInterCourierCharge: interCourierCharge},
    };

    return (
        <PageFrame section="Dashboards" title="Search" toolbarActions={toolbarActions}>
            <ErrorBoundary>
                <JobSearchPage
                    showToast={showPageToast}
                    isUsCustomer={isUsCustomer}
                    timeZone={session.timeZone || 'New Zealand Standard Time'}
                    deepLinkJobId={jobId}
                    onExitColumnEditMode={handleExitColumnEditMode}
                    onLayoutBridgeReady={handleBridgeReady}
                />
            </ErrorBoundary>
        </PageFrame>
    );
};
