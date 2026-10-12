import React, {useMemo} from 'react';
import {AppShell} from '../components/common/app-shell/AppShell';
import type {ToolbarActionsConfig} from '../components/common/app-shell/ToolbarActionsView';
import {buildToolbarChildren} from '../components/common/app-shell/ToolbarActionsView';
import type {BreadcrumbItem} from '../components/common/app-toolbar/AppToolbar';
import {useMessagingDialog} from '../hooks/useMessagingDialog';
import {useUnreadMessageCount} from '../hooks/useUnreadMessageCount';
import {openHubUrl, openJobInSearch} from '../services/navigationService';
import {getSession} from '../session';
import {pageBodyStyle} from './layoutConstants';
import {useNavigation} from './NavigationContext';

export interface PageFrameProps {
    title: string;
    section?: string;
    beta?: boolean;
    /** Merged over the defaults (messages, partner approvals); a page-supplied `messages` replaces the default. */
    toolbarActions?: ToolbarActionsConfig;
    /** Body scrolls instead of clipping. */
    scrollable?: boolean;
    children?: React.ReactNode;
}

export const PageFrame: React.FC<PageFrameProps> = ({title, section, beta, toolbarActions, scrollable = false, children}) => {
    const {navigate, currentState} = useNavigation();
    const session = getSession();
    const {count, refresh} = useUnreadMessageCount();
    const {openMessaging} = useMessagingDialog({refreshUnreadCount: refresh});

    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        const crumbs: BreadcrumbItem[] = [];
        if (section) crumbs.push({label: section});
        if (title) crumbs.push({label: title});
        return crumbs;
    }, [section, title]);

    const actions: ToolbarActionsConfig = {
        messages: {unreadCount: count, onClick: () => void openMessaging()},
        partnerApprovals: {enabled: true, onOpenJob: (jobId) => openJobInSearch(jobId)},
        ...toolbarActions,
    };

    return (
        <div style={{position: 'relative'}}>
            <AppShell
                title={title}
                breadcrumbs={breadcrumbs}
                beta={beta}
                firstName={session.firstName}
                fullName={session.fullName}
                isUsCustomer={session.isUsCustomer ?? false}
                isNetworkPartner={session.isNetworkPartner}
                currentState={currentState}
                onLogoClick={openHubUrl}
                onNavigate={(state) => navigate(state)}
            >
                {buildToolbarChildren(actions)}
            </AppShell>
            <div style={pageBodyStyle(scrollable)}>{children}</div>
        </div>
    );
};
