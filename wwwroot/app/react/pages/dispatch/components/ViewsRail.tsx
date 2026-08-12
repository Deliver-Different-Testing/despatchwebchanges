/**
 * Views Rail
 *
 * The scope selector at the top of the dispatch job list card: one pill per
 * admin-configured page view, multi-select, scrolling horizontally when the
 * card is narrow. Ports the V1 job-list card's view tab strip
 * (`components/home/home.template.html` `.view-tabs-header`).
 *
 * Presentational only — the page owns the selection and its persistence.
 */

import React from 'react';
import {Box, Button, Group, Skeleton, Text} from '@mantine/core';
import {Layers, ListX} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';
import {headerSurfaceAccent} from '../../../components/dialogs/shared/mantine/styles';
import classes from './ViewsRail.module.css';

export interface ViewsRailProps {
    views: DfrntPageViewModel[];
    selectedIds: number[];
    /**
     * Drives the empty-selection copy: with no view selected the server returns
     * every job on US tenants but nothing at all on NZ tenants
     * (`Repositories/BaseJobRepository.cs`).
     */
    isUsCustomer: boolean;
    loading?: boolean;
    onToggle: (viewId: number) => void;
    onClearAll: () => void;
}

// Matches the card's standard toolbar chrome (JobListToolbar) so the rail and
// the category tabs below it read as one bar of controls.
const railStyle: React.CSSProperties = {
    minHeight: 40,
    borderBottom: '1px solid var(--mantine-color-default-border)',
    backgroundColor: 'var(--dd-surface-container)',
    // The pills borrow SegmentedToggle's selection recipe (tonal fill + 1px
    // accent border + Ink label) so multi-select speaks the same grammar as the
    // single-select toggles, without an indicator it could not share.
    '--vp-accent': headerSurfaceAccent,
} as React.CSSProperties;

export const ViewsRail: React.FC<ViewsRailProps> = ({
    views,
    selectedIds,
    isUsCustomer,
    loading = false,
    onToggle,
    onClearAll,
}) => {
    if (loading) {
        return (
            <Group align="center" gap="sm" px="md" py={6} wrap="nowrap" style={railStyle} data-testid="views-rail-loading">
                <Icon lucide={Layers} size={16} color="var(--mantine-color-dimmed)" aria-hidden/>
                {[96, 78, 64].map(width => (
                    <Skeleton key={width} width={width} height={28} radius="sm"/>
                ))}
            </Group>
        );
    }

    if (views.length === 0) return null;

    return (
        <Group align="center" gap="sm" px="md" py={6} wrap="nowrap" style={railStyle}>
            <Icon lucide={Layers} size={16} color="var(--mantine-color-dimmed)" aria-hidden style={{flexShrink: 0}}/>
            <Box className={classes.scroll}>
                {/*
                  * Multi-select toggles, so these stay buttons with `aria-pressed`
                  * rather than becoming a `Chip.Group` — Mantine chips are checkboxes,
                  * which reads wrong for a scope filter and loses the pressed state.
                  */}
                <Group gap="xs" wrap="nowrap" role="group" aria-label="Job list views">
                    {views.map(view => {
                        const selected = selectedIds.includes(view.id);
                        return (
                            <Button
                                key={view.id}
                                size="compact-xs"
                                variant="default"
                                className={classes.viewPill}
                                data-selected={selected || undefined}
                                aria-pressed={selected}
                                onClick={() => onToggle(view.id)}
                                style={{whiteSpace: 'nowrap'}}
                            >
                                {view.name}
                            </Button>
                        );
                    })}
                </Group>
            </Box>
            {selectedIds.length > 0 ? (
                <Button
                    size="compact-sm"
                    variant="subtle"
                    leftSection={<Icon lucide={ListX} size={16}/>}
                    onClick={onClearAll}
                    style={{flexShrink: 0}}
                >
                    Clear
                </Button>
            ) : (
                <Text size="xs" c="dimmed" style={{flexShrink: 0}}>
                    {isUsCustomer ? 'No view selected — showing all jobs.' : 'Select a view to load jobs.'}
                </Text>
            )}
        </Group>
    );
};

export default ViewsRail;
