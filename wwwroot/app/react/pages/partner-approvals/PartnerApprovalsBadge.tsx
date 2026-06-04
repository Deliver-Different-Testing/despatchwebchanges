/**
 * Partner Approvals badge — the global surface that makes the approver
 * inbox discoverable. Sits in the app shell, shows a live count of
 * pending requests, and opens the inbox in a right-side drawer when
 * clicked.
 *
 * Designed to drop into any existing toolbar / app-bar. Pulls from the
 * same query as the inbox itself so the count and the list never disagree.
 */

import React, {useState, useMemo} from 'react';
import {alpha} from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import HandshakeIcon from '@mui/icons-material/Handshake';
import type {SxProps, Theme} from '@mui/material/styles';
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

// Toolbar-styled icon button — mirrors the hover treatment used by the
// other AppToolbar actions (Messages, Refresh, etc.) so the badge looks
// native to the bar rather than bolted on.
const toolbarIconButtonSx: SxProps<Theme> = {
    p: 1,
    '&:hover': {
        bgcolor: (theme: Theme) => alpha(theme.palette.common.white, 0.12),
    },
};

export const PartnerApprovalsBadge: React.FC<PartnerApprovalsBadgeProps> = ({
    onOpenJob,
    toolbarVariant = false,
}) => {
    const [open, setOpen] = useState(false);
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
            <Tooltip title={tooltip}>
                <IconButton
                    onClick={() => setOpen(true)}
                    aria-label="Open partner approvals"
                    color={toolbarVariant ? 'inherit' : undefined}
                    size={toolbarVariant ? undefined : 'small'}
                    sx={toolbarVariant ? toolbarIconButtonSx : {position: 'relative'}}
                >
                    <Badge
                        badgeContent={count}
                        color={hasOverdue ? 'error' : 'warning'}
                        max={99}
                        invisible={count === 0}
                        sx={toolbarVariant ? {
                            '& .MuiBadge-badge': {
                                fontSize: '0.65rem',
                                minWidth: 18,
                                height: 18,
                            },
                        } : undefined}
                    >
                        <HandshakeIcon sx={toolbarVariant ? {fontSize: 22} : undefined}/>
                    </Badge>
                </IconButton>
            </Tooltip>

            <Drawer
                anchor="right"
                open={open}
                onClose={() => setOpen(false)}
                slotProps={{
                    paper: {
                        elevation: 24,
                        sx: {
                            width: {xs: '100%', sm: 460},
                            bgcolor: 'background.default',
                            overflow: 'hidden',
                        },
                    },
                }}
            >
                <Box sx={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                    <PartnerApprovalsInbox
                        onOpenJob={(jobId, jobNo) => {
                            onOpenJob?.(jobId, jobNo);
                            setOpen(false);
                        }}
                    />
                </Box>
            </Drawer>
        </>
    );
};
