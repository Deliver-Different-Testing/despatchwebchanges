/**
 * Partner Job Banner — slim contextual rail rendered at the top of
 * Job Details whenever the loaded job is a partner job.
 *
 * The legacy "Partner Job" chip in the toolbar told users *what* the job
 * was but not *what that means*. This banner explains the implication in
 * one line: which fields auto-sync, which need approval, and where the
 * change requests live. Dismissible per user via localStorage so power
 * users don't see it on every job — a small Info button reopens it.
 *
 * Intentionally lightweight: no animations, no avatars, no partner-tenant
 * branding (we don't have that data plumbed yet). Visual signal comes from
 * a coloured left border that matches the "Partner Job" chip's info colour.
 */

import React, {useState, useCallback, useEffect} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HandshakeIcon from '@mui/icons-material/Handshake';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {alpha} from '@mui/material/styles';

const STORAGE_KEY = 'despatchweb.partnerJobBanner.dismissed';

export interface PartnerJobBannerProps {
    partnerName?: string;
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

export const PartnerJobBanner: React.FC<PartnerJobBannerProps> = ({partnerName}) => {
    const [dismissed, setDismissed] = useState(() => readDismissed());

    useEffect(() => {
        writeDismissed(dismissed);
    }, [dismissed]);

    const handleDismiss = useCallback(() => setDismissed(true), []);
    const handleRestore = useCallback(() => setDismissed(false), []);

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
                <Typography variant="caption" color="text.secondary" sx={{display: 'block', lineHeight: 1.4}}>
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
