/**
 * PanelHeader — the header used at the top of every card panel on a workspace
 * page (Filters, Recurring Jobs, Job Details, Recurring Log…).
 *
 * A plain paper bar with a bare leading glyph, title, an optional trailing
 * count, an optional uppercase badge chip, and an optional right-aligned action
 * slot (e.g. a refresh button). It uses the `'surface'` header variant, so a
 * divider keyline — not a change of colour — separates it from the card body,
 * and the title reads as part of its card. This mirrors the approach in
 * `SectionHeader.tsx`, which is the in-card-section equivalent; PanelHeader is
 * the page/card-level header and additionally carries a count and badge chip.
 */

import React from 'react';
import {Badge, Box, Group, Text} from '@mantine/core';
import {headerChromeStyle} from '../../dialogs/shared/mantine/styles';

interface PanelHeaderProps {
    /**
     * The leading glyph — bare, with no badge behind it. Pass a rendered element:
     * an `<Icon lucide={…}/>` or a `<SymbolIcon name="tune" />`. It inherits the
     * bar's own on-colour, which is colour-scheme aware, so callers must not
     * colour it themselves.
     */
    icon: React.ReactNode;
    title: string;
    /** Optional trailing count, rendered as `(n)` after the title. */
    count?: number;
    /** Optional uppercase chip rendered after the title (e.g. "RECURRING"). */
    badge?: string;
    /** Right-aligned slot for buttons / status indicators. */
    action?: React.ReactNode;
}

/**
 * Shared header chrome, overridden for the panel's compact fixed-height bar.
 *
 * Fixed (not min) height so every panel header is identical regardless of which
 * action controls it carries — 48px is the bar's grid line (a 32px control band +
 * 2×8px padding). Controls up to 44px centre within it without changing the box.
 */
const rootStyle: React.CSSProperties = {
    ...headerChromeStyle('surface'),
    height: 48,
    boxSizing: 'border-box',
    flexShrink: 0,
};

export const PanelHeader = React.memo(function PanelHeader({
    icon,
    title,
    count,
    badge,
    action,
}: PanelHeaderProps) {
    return (
        <Group gap="sm" px="md" py="xs" wrap="nowrap" style={rootStyle} data-testid="panel-header">
            <Box
                data-testid="panel-header-icon"
                style={{display: 'flex', alignItems: 'center', flexShrink: 0, color: 'inherit'}}
            >
                {icon}
            </Box>
            <Group gap="xs" wrap="nowrap" style={{flex: 1, minWidth: 0}}>
                <Text
                    truncate
                    fw={700}
                    c="inherit"
                    style={{fontSize: '1.125rem', letterSpacing: '-0.01em', lineHeight: 1.2}}
                >
                    {count != null ? `${title} (${count})` : title}
                </Text>
                {badge && (
                    /*
                     * 10px bold needs the full body colour to clear AA, so the label
                     * takes `variant="default"` rather than any brand tint.
                     */
                    <Badge
                        variant="default"
                        h={20}
                        fw={700}
                        style={{fontSize: 10, letterSpacing: '0.6px', border: 'none'}}
                    >
                        {badge}
                    </Badge>
                )}
            </Group>
            {action && (
                <Box style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, color: 'inherit'}}>
                    {action}
                </Box>
            )}
        </Group>
    );
});

export default PanelHeader;
