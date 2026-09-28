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
 * Visual signal comes from a coloured left border — Reflex Blue for the
 * normal case, brand orange for the stale-link case.
 */

import React, {useCallback} from 'react';
import {ActionIcon, alpha, Box, Text, Tooltip} from '@mantine/core';
import {useLocalStorage} from '@mantine/hooks';
import {Handshake, Info, Link2Off, X} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import {dfrntBrand} from '../../../../theme/dfrntMantineTheme';

const STORAGE_KEY = 'despatchweb.partnerJobBanner.dismissed';

/**
 * Reflex Blue, pinned rather than taken from the Mantine `info` variant: `info`
 * is the tenant primary (Cyan on US), which would repaint this banner in the
 * brand colour. It has always been reflex — the MUI `info.main` hex — and stays
 * so. Orange keeps carrying the blocking state.
 */
const bannerAccent = {
    info: dfrntBrand.reflexBlue,
    warning: dfrntBrand.orange,
} as const;

export interface PartnerJobBannerProps {
    partnerName?: string;
    /**
     * IntMgrPartnerPairing.Id the job is linked to. When undefined / null
     * for a partner job the banner switches to the "stale partner link"
     * warning variant — change requests can't be routed without it.
     */
    pairingId?: number | null;
}

const railStyle = (accent: string, tint: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingInline: 16,
    paddingBlock: 8,
    marginInline: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: accent,
    backgroundColor: alpha(accent, tint),
    borderRadius: 'var(--mantine-radius-xs)',
});

export const PartnerJobBanner: React.FC<PartnerJobBannerProps> = ({partnerName, pairingId}) => {
    const [dismissed, setDismissed, clearDismissed] = useLocalStorage({
        key: STORAGE_KEY,
        defaultValue: false,
        // Keeps the pre-existing '1'/absent encoding: dismissing writes '1' and
        // restoring removes the key outright, so a banner dismissed before this
        // hook landed stays dismissed.
        serialize: (value) => (value ? '1' : ''),
        deserialize: (value) => value === '1',
        // Read synchronously on first render — the default defers to an effect,
        // which would flash the banner before the stored dismissal applies.
        getInitialValueInEffect: false,
    });

    const handleDismiss = useCallback(() => setDismissed(true), [setDismissed]);
    const handleRestore = useCallback(() => clearDismissed(), [clearDismissed]);

    // Stale link: a partner job whose source pairing isn't recorded locally.
    // Change-request routing requires the pairing id, so editing this job will
    // fail server-side on a tenant with multiple active pairings. Non-dismissible
    // because it's a blocker, not informational guidance.
    if (pairingId == null) {
        return (
            <Box
                role="region"
                aria-label="Stale partner link"
                style={railStyle(bannerAccent.warning, 0.08)}
            >
                <Icon lucide={Link2Off} size={22} color={bannerAccent.warning} style={{flexShrink: 0}} aria-hidden/>
                <Box style={{flex: 1, minWidth: 0}}>
                    <Text fz="sm" fw={600} style={{lineHeight: 1.3}}>
                        Stale partner link
                    </Text>
                    <Text fz="xs" c="dimmed" style={{display: 'block', lineHeight: 1.4}}>
                        This partner job is missing its pairing reference, so change requests
                        can&apos;t be routed. Resend the job to {partnerName ?? 'the partner'} to
                        re-establish the link.
                    </Text>
                </Box>
            </Box>
        );
    }

    if (dismissed) {
        return (
            <Box style={{display: 'flex', justifyContent: 'flex-end', paddingInline: 16, paddingTop: 4}}>
                <Tooltip label="Show partner-job guidance">
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleRestore} aria-label="Show partner-job guidance">
                        <Icon lucide={Info} size={18} color={bannerAccent.info}/>
                    </ActionIcon>
                </Tooltip>
            </Box>
        );
    }

    return (
        <Box
            role="region"
            aria-label="Partner job context"
            style={railStyle(bannerAccent.info, 0.06)}
        >
            <Icon lucide={Handshake} size={22} color={bannerAccent.info} style={{flexShrink: 0}} aria-hidden/>
            <Box style={{flex: 1, minWidth: 0}}>
                <Text fz="sm" fw={600} style={{lineHeight: 1.3}}>
                    Partner job{partnerName ? ` — owned by ${partnerName}` : ''}
                </Text>
                <Text fz="xs" c="dimmed" style={{display: 'block', lineHeight: 1.4}}>
                    Notes, references and tracking sync automatically. Rate, dates, contacts and addresses need
                    partner approval — your edits queue as change requests below.
                </Text>
            </Box>
            <Tooltip label="Dismiss for this device">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleDismiss} aria-label="Dismiss for this device">
                    <Icon lucide={X} size={18}/>
                </ActionIcon>
            </Tooltip>
        </Box>
    );
};
