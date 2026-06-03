/**
 * Partner Job Banner — slim contextual rail rendered at the top of
 * Job Details whenever the loaded job is a partner job.
 *
 * Two states:
 *
 *   1. Healthy link (pairingId present) — dismissible info banner that
 *      explains the change-request workflow up-front so dispatchers don't
 *      discover gated fields by trying them.
 *
 *   2. Stale partner link (pairingId missing) — non-dismissible warning
 *      banner. Some pre-existing partner jobs were created before the
 *      column was being populated; on a tenant with multiple active
 *      partner pairings the change-request resolver can't route their
 *      edits and any submission fails server-side. The dispatcher needs
 *      to redispatch the job to the partner to recreate the link rather
 *      than try to edit the stale mirror.
 *
 * Visual signal comes from a coloured left border — info.main for the
 * normal case, warning.main for the stale-link case.
 */

import React, {useState, useCallback, useEffect} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {alpha} from '@mui/material/styles';

const STORAGE_KEY = 'despatchweb.partnerJobBanner.dismissed';

export interface PartnerJobBannerProps {
    partnerName?: string;
    /**
     * IntMgrPartnerPairing.Id the job is linked to. When undefined / null
     * for a partner job the banner switches to the "stale partner link"
     * warning variant — change requests can't be routed without it.
     */
    pairingId?: number | null;
}

function readDismissed(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function writeDismissed(value: boolean): void {
    try {
        if (value) {
            window.localStorage.setItem(STORAGE_KEY, '1');
        } else {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // localStorage unavailable (private mode, etc.) — silently ignore.
    }
}

export const PartnerJobBanner: React.FC<PartnerJobBannerProps> = ({partnerName, pairingId}) => {
    const [dismissed, setDismissed] = useState(() => readDismissed());

    useEffect(() => {
        writeDismissed(dismissed);
    }, [dismissed]);

    const handleDismiss = useCallback(() => setDismissed(true), []);
    const handleRestore = useCallback(() => setDismissed(false), []);

    // Stale link: a partner job whose source pairing isn't recorded locally.
    // Change-request routing requires the pairing id, so editing this job will
    // fail server-side on a tenant with multiple active pairings. Non-dismissible
    // because it's a blocker, not informational guidance.
    if (pairingId == null) {
        return (
            <Box
                role="region"
                aria-label="Stale partner link"
                sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1,
                    mx: 1.5,
                    mt: 1,
                    borderLeft: 3,
                    borderLeftColor: 'warning.main',
                    bgcolor: alpha(theme.palette.warning.main, 0.08),
                    borderRadius: 1,
                })}
            >
                <LinkOffIcon sx={{color: 'warning.main', fontSize: 22, flexShrink: 0}}/>
                <Box sx={{flex: 1, minWidth: 0}}>
                    <Typography variant="subtitle2" sx={{lineHeight: 1.3, fontWeight: 600}}>
                        Stale partner link
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            display: 'block',
                            lineHeight: 1.4
                        }}>
                        This partner job is missing its pairing reference, so change requests
                        can&apos;t be routed. Resend the job to {partnerName ?? 'the partner'} to
                        re-establish the link.
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (dismissed) {
        return (
            <Box sx={{display: 'flex', justifyContent: 'flex-end', px: 2, pt: 0.5}}>
                <Tooltip title="Show partner-job guidance">
                    <IconButton size="small" onClick={handleRestore}>
                        <InfoOutlinedIcon fontSize="small" color="info"/>
                    </IconButton>
                </Tooltip>
            </Box>
        );
    }

    return (
        <Box
            role="region"
            aria-label="Partner job context"
            sx={(theme) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                mx: 1.5,
                mt: 1,
                borderLeft: 3,
                borderLeftColor: 'info.main',
                bgcolor: alpha(theme.palette.info.main, 0.06),
                borderRadius: 1,
            })}
        >
            <HandshakeIcon sx={{color: 'info.main', fontSize: 22, flexShrink: 0}}/>
            <Box sx={{flex: 1, minWidth: 0}}>
                <Typography variant="subtitle2" sx={{lineHeight: 1.3, fontWeight: 600}}>
                    Partner job{partnerName ? ` — owned by ${partnerName}` : ''}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        color: "text.secondary",
                        display: 'block',
                        lineHeight: 1.4
                    }}>
                    Notes, references and tracking sync automatically. Rate, dates, contacts and addresses need
                    partner approval — your edits queue as change requests below.
                </Typography>
            </Box>
            <Tooltip title="Dismiss for this device">
                <IconButton size="small" onClick={handleDismiss}>
                    <CloseIcon fontSize="small"/>
                </IconButton>
            </Tooltip>
        </Box>
    );
};
