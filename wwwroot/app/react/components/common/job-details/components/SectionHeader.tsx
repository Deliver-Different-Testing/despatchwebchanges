/**
 * SectionHeader - the header used by every job-detail section card.
 *
 * A bar carrying an icon, title, optional subtitle, and an optional end-action
 * slot for buttons / chips.
 *
 * Variants:
 *   - 'primary'   →  plain card bar with a divider keyline (the default)
 *   - 'pickup'    →  map-blue fill
 *   - 'delivery'  →  green fill
 *
 * Only pickup and delivery are filled: they carry the universal pickup-blue /
 * delivery-green convention used on every map, so the colour is meaning rather
 * than decoration. Every other section is neutral, matching `PanelHeader` — the
 * page/card-level equivalent.
 */

import React from 'react';
import {Box, Text} from '@mantine/core';
import {Icon, type LucideIcon, type TablerIcon} from '../../icon/Icon';
import {dfrntBrand} from '../../../../theme/dfrntMantineTheme';
import {headerColors} from '../../../dialogs/shared/mantine/styles';

export type SectionHeaderVariant = 'primary' | 'pickup' | 'delivery';

interface SectionHeaderProps {
    /**
     * The leading glyph. Takes the same discriminated pair as `<Icon>` rather
     * than a rendered node so the header — not each of its ~20 call sites — owns
     * the size, stroke and on-colour.
     */
    lucide?: LucideIcon;
    tabler?: TablerIcon;
    title: string;
    subtitle?: string;
    /** Right-aligned slot for buttons, chips, or status indicators. */
    endAction?: React.ReactNode;
    dense?: boolean;
    variant?: SectionHeaderVariant;
}

/**
 * Pickup and delivery keep the map-flag blue/green — the same `reflexBlue` /
 * `green` the MUI theme served them as `info` / `success`. They are deliberately
 * NOT the tenant brand: the map flags are fixed for every tenant, so keying
 * these off the brand would break the pairing on the gold tenant. Everything
 * else is the neutral card bar, whose tokens are colour-scheme aware.
 */
export const sectionHeaderColors: Record<SectionHeaderVariant, {bg: string; fg: string}> = {
    primary: headerColors.surface,
    pickup: {bg: dfrntBrand.reflexBlue, fg: dfrntBrand.white},
    delivery: {bg: dfrntBrand.green, fg: dfrntBrand.white},
};

export const SectionHeader = React.memo(function SectionHeader({
    lucide,
    tabler,
    title,
    subtitle,
    endAction,
    dense,
    variant = 'primary',
}: SectionHeaderProps) {
    const {bg, fg} = sectionHeaderColors[variant];
    return (
        <Box
            data-testid="section-header"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: dense ? 8 : 10,
                paddingInline: dense ? 12 : 16,
                paddingBlock: dense ? 6 : 8,
                minHeight: dense ? 40 : 48,
                backgroundColor: bg,
                color: fg,
                // The neutral bar shares the card's fill, so it needs a keyline to
                // separate it from the body; the two coloured fills separate
                // themselves. Written as longhands because jsdom drops a
                // `border-bottom` shorthand that carries a `var()`, which would make
                // the keyline untestable.
                ...(variant === 'primary' ? {
                    borderBottomWidth: 1,
                    borderBottomStyle: 'solid' as const,
                    borderBottomColor: 'var(--mantine-color-default-border)',
                } : {}),
            }}
        >
            <Icon
                lucide={lucide}
                tabler={tabler}
                size={dense ? 18 : 20}
                // The glyph takes the bar's own on-colour on every variant — ink on
                // the neutral bar (colour-scheme aware, so it inverts in dark mode),
                // white on the two coloured fills.
                color="currentColor"
                style={{flexShrink: 0}}
                aria-hidden
            />
            <Box style={{flex: 1, minWidth: 0}}>
                <Text
                    style={{
                        fontSize: dense ? '0.8125rem' : '0.9375rem',
                        fontWeight: 700,
                        letterSpacing: '-0.005em',
                        color: 'inherit',
                        lineHeight: 1.2,
                    }}
                >
                    {title}
                </Text>
                {subtitle && (
                    <Text
                        style={{
                            fontSize: dense ? '0.6875rem' : '0.75rem',
                            color: 'inherit',
                            opacity: 0.85,
                            lineHeight: 1.4,
                            marginTop: 1,
                        }}
                    >
                        {subtitle}
                    </Text>
                )}
            </Box>
            {endAction && (
                <Box
                    style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'inherit',
                    }}
                >
                    {endAction}
                </Box>
            )}
        </Box>
    );
});
