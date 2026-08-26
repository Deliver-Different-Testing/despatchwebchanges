/**
 * Partner Approvals badge — the global surface that makes the approver
 * inbox discoverable. Sits in the app shell, shows a live count of
 * pending requests, and opens the inbox in a right-side drawer when
 * clicked.
 *
 * Designed to drop into any existing toolbar / app-bar. Pulls from the
 * same query as the inbox itself so the count and the list never disagree.
 */

import React, {useMemo} from 'react';
import {ActionIcon, Drawer, Indicator, Tooltip} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {Handshake} from 'lucide-react';
import {Icon} from '../../components/common/icon/Icon';
import {badgeOverflowStyle, toolbarIconButtonStyle} from '../../components/common/app-toolbar/ToolbarActions';
import {useApproverInbox} from './useApproverInbox';
import {useHasActivePartners} from './useHasActivePartners';
import {PartnerApprovalsInbox} from './PartnerApprovalsInbox';
import {ageLevel} from '../../components/job-change-requests/jobChangeRequestFormatting';

export interface PartnerApprovalsBadgeProps {
    /**
     * Optional handler invoked when a user clicks a row's job link in
     * the drawer. The AngularJS shell wires this to openJobInSearch.
     */
    onOpenJob?: (jobId: number, jobNo: string) => void;
    /**
     * When true, the icon button inherits the toolbar's foreground colour
     * (white on the primary app-bar background) and matches the spacing
     * used by the other toolbar action buttons. Defaults to false for
     * standalone usage outside the app bar.
     */
    toolbarVariant?: boolean;
}

export const PartnerApprovalsBadge: React.FC<PartnerApprovalsBadgeProps> = ({
    onOpenJob,
    toolbarVariant = false,
}) => {
    const [opened, {open, close}] = useDisclosure(false);
    const {data: hasActivePartners} = useHasActivePartners();
    const {data: items = []} = useApproverInbox({enabled: hasActivePartners === true});

    const {count, hasOverdue} = useMemo(() => {
        let overdue = false;
        for (const it of items) {
            if (ageLevel(it.request.requestedAt) === 'overdue') {
                overdue = true;
                break;
            }
        }
        return {count: items.length, hasOverdue: overdue};
    }, [items]);

    const tooltip = count === 0
        ? 'No partner approvals waiting'
        : `${count} partner approval${count === 1 ? '' : 's'} waiting${hasOverdue ? ' (overdue)' : ''}`;

    // Hide the badge entirely for tenants with no active partner pairings.
    // While the gating query is still resolving we render nothing — partner
    // status doesn't change often, and a brief absence is preferable to a
    // visible flash that disappears once the answer arrives.
    if (hasActivePartners !== true) {
        return null;
    }

    return (
        <>
            <Tooltip label={tooltip}>
                <ActionIcon
                    onClick={open}
                    aria-label="Open partner approvals"
                    size={toolbarVariant ? 'lg' : 30}
                    variant="subtle"
                    color={toolbarVariant ? undefined : 'gray'}
                    style={toolbarVariant ? {...toolbarIconButtonStyle, ...badgeOverflowStyle} : badgeOverflowStyle}
                >
                    <Indicator
                        label={count > 99 ? '99+' : count}
                        disabled={count === 0}
                        color={hasOverdue ? 'red' : 'orange'}
                        size={18}
                        offset={2}
                    >
                        <Icon lucide={Handshake} size={toolbarVariant ? 22 : 18} />
                    </Indicator>
                </ActionIcon>
            </Tooltip>

            <Drawer
                opened={opened}
                onClose={close}
                position="right"
                size={460}
                padding={0}
                withCloseButton={false}
                styles={{
                    content: {
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        backgroundColor: 'var(--mantine-color-body)',
                    },
                    body: {flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'},
                }}
            >
                <PartnerApprovalsInbox
                    onOpenJob={(jobId, jobNo) => {
                        onOpenJob?.(jobId, jobNo);
                        close();
                    }}
                />
            </Drawer>
        </>
    );
};
