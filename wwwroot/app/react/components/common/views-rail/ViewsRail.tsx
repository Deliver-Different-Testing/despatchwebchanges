/**
 * Views Rail
 *
 * The scope selector at the top of a dashboard-style page's job list card: one
 * pill per admin-configured page view, multi-select, scrolling horizontally
 * when the card is narrow. Ports the V1 job-list card's view tab strip
 * (`components/home/home.template.html` `.view-tabs-header`). Shared by
 * Dispatch and Nationwide.
 *
 * Presentational only — the page owns the selection and its persistence.
 */

import React from 'react';
import {Box, Group, Skeleton} from '@mantine/core';
import {Layers, ListX} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {ACTION_BUTTON_HEIGHT, ActionButton,} from '../action-button';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../panel-controls';
import classes from './ViewsRail.module.css';
import {ViewsRailProps} from "./ViewsRailProps";

// Matches the card's standard toolbar chrome (JobListToolbar) so the rail and
// the category tabs below it read as one bar of controls — same 48px band, same
// chip material, since both are built from the shared raised-chip button. The
// rail's own padding is 4px rather than 8: `.scroll` adds the other 4 to clear
// the chips' shadow.
const railStyle: React.CSSProperties = {
    minHeight: 48,
    borderBottom: '1px solid var(--mantine-color-default-border)',
    backgroundColor: 'var(--dd-surface-container)',
};

export const ViewsRail: React.FC<ViewsRailProps> = ({
    views,
    selectedIds,
    loading = false,
    onToggle,
    onClearAll,
}) => {
    const hasSelection = selectedIds.length > 0;

    if (loading) {
        return (
            <Group align="center" gap="sm" px="md" py={4} wrap="nowrap" style={railStyle} data-testid="views-rail-loading">
                <Icon lucide={Layers} size={16} color="var(--mantine-color-dimmed)" aria-hidden/>
                {[96, 78, 64].map(width => (
                    <Skeleton key={width} width={width} height={ACTION_BUTTON_HEIGHT} radius={9999}/>
                ))}
            </Group>
        );
    }

    if (views.length === 0) return null;

    return (
        <Group align="center" gap="sm" px="md" py={4} wrap="nowrap" style={railStyle}>
            <HeaderActionIcon
                label="Clear selected views"
                disabled={!hasSelection}
                onClick={onClearAll}
                style={{flexShrink: 0}}
            >
                <Icon lucide={ListX} size={PANEL_CONTROL_GLYPH_SIZE}/>
            </HeaderActionIcon>
            <Box className={classes.scroll}>
                {/*
                  * Multi-select toggles, so these stay buttons with `aria-pressed`
                  * rather than becoming a `Chip.Group` — Mantine chips are checkboxes,
                  * which reads wrong for a scope filter and loses the pressed state.
                  */}
                <Group gap="xs" wrap="nowrap" className={classes.pills} role="group" aria-label="Job list views">
                    {views.map(view => (
                        <ActionButton
                            key={view.id}
                            selected={selectedIds.includes(view.id)}
                            onClick={() => onToggle(view.id)}
                            style={{whiteSpace: 'nowrap'}}
                        >
                            {view.name}
                        </ActionButton>
                    ))}
                </Group>
            </Box>
        </Group>
    );
};

export default ViewsRail;
