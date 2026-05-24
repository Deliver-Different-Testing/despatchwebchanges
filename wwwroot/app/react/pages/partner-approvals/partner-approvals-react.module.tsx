/**
 * Partner Approvals React Module
 *
 * Mounts the badge into a host element provided by the AngularJS shell.
 * Following the same pattern as task-dashboard-react.module.tsx so the
 * AngularJS side only needs a single `<div id="partnerApprovalsBadge"></div>`
 * in the global toolbar plus a call to `window.ReactPartnerApprovals.mount`
 * on app start.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import {getTheme} from '../../theme/muiTheme';
import {ReactQueryProvider} from '../../query';
import {ErrorBoundary} from '../../components/common/error-boundary';
import {PartnerApprovalsBadge} from './PartnerApprovalsBadge';

export interface MountPartnerApprovalsConfig {
    /** Optional handler routed from the badge's drawer to the AngularJS shell. */
    onOpenJob?: (jobId: number, jobNo: string) => void;
}

let root: Root | null = null;
let container: HTMLElement | null = null;

export function mountPartnerApprovalsBadge(containerId: string, config: MountPartnerApprovalsConfig = {}): void {
    if (root && container && container.id !== containerId) {
        root.unmount();
        root = null;
        container = null;
    }

    let host = document.getElementById(containerId);
    if (!host) {
        console.warn('[PartnerApprovals] Container not found, creating fallback:', containerId);
        host = document.createElement('div');
        host.id = containerId;
        document.body.appendChild(host);
    }

    container = host;
    if (!root) {
        root = createRoot(host);
    }

    root.render(
        <ReactQueryProvider>
            <ThemeProvider theme={getTheme()}>
                <ErrorBoundary>
                    <PartnerApprovalsBadge onOpenJob={config.onOpenJob}/>
                </ErrorBoundary>
            </ThemeProvider>
        </ReactQueryProvider>,
    );
}

export function unmountPartnerApprovalsBadge(): void {
    if (root) {
        root.unmount();
        root = null;
    }
    container = null;
}

declare global {
    interface Window {
        ReactPartnerApprovals?: {
            mount: (containerId: string, config?: MountPartnerApprovalsConfig) => void;
            unmount: () => void;
        };
    }
}

window.ReactPartnerApprovals = {
    mount: mountPartnerApprovalsBadge,
    unmount: unmountPartnerApprovalsBadge,
};

// Register as AngularJS module for ocLazyLoad compatibility.
const partnerApprovalsReactModule = window.angular!.module('uDispatch.partnerApprovalsReact', []);
export default partnerApprovalsReactModule;
