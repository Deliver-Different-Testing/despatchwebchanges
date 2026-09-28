import React, {useCallback} from 'react';
import {ActionIcon, Button, Card, Checkbox, Divider, Group, Progress, SimpleGrid, Stack, Text} from '@mantine/core';
import dayjs from 'dayjs';
import type {ISuggestion, DateRange} from '../OverviewPage.interfaces';
import {overviewApi} from '../../../services/overviewApi';
import {PanelHeader} from '../../../components/common/panel-header';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import {ChipsAutocomplete} from '../../../components/common/search-criteria-panel/ChipsAutocomplete';
import {
    CRITERION_GAP,
    CRITERION_LABEL_GAP,
    GroupLabel,
} from '../../../components/common/filter-fields';
import {useDialogLoader} from '../../../components/common/job-details/hooks/useDialogLoader';

/**
 * The "select all" affordance beside a criterion's label. A checkbox rather than
 * a link so it reports its own state, and quiet enough not to compete with the
 * options it governs.
 */
const SelectAllToggle: React.FC<{checked: boolean; onChange: () => void; label: string}> = ({
    checked,
    onChange,
    label,
}) => (
    <Checkbox
        size="xs"
        checked={checked}
        onChange={onChange}
        aria-label={checked ? `Unselect all ${label}` : `Select all ${label}`}
        label={
            <Text fz="xs" c="dimmed">
                {checked ? 'Unselect all' : 'Select all'}
            </Text>
        }
    />
);

interface FilterPanelProps {
    regions: ISuggestion[];
    regionsLoading: boolean;
    selectedRegionIds: Set<number>;
    allRegionsSelected: boolean;
    onToggleRegion: (regionId: number) => void;
    onToggleAllRegions: () => void;

    speeds: ISuggestion[];
    speedsLoading: boolean;
    selectedSpeedIds: Set<number>;
    allSpeedsSelected: boolean;
    onToggleSpeed: (speedId: number) => void;
    onToggleAllSpeeds: () => void;

    selectedCouriers: ISuggestion[];
    onAddCourier: (courier: ISuggestion) => void;
    onRemoveCourier: (courierId: number) => void;

    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
    /** Resets every criterion at once. */
    onClearAll: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
    regions,
    regionsLoading,
    selectedRegionIds,
    allRegionsSelected,
    onToggleRegion,
    onToggleAllRegions,
    speeds,
    speedsLoading,
    selectedSpeedIds,
    allSpeedsSelected,
    onToggleSpeed,
    onToggleAllSpeeds,
    selectedCouriers,
    onAddCourier,
    onRemoveCourier,
    dateRange,
    onDateRangeChange,
    onClearAll,
}) => {

    /*
     * ChipsAutocomplete owns the debounce and the in-flight guard, so this is a
     * bare call rather than a react-query hook keyed on typed text.
     */
    const searchCouriers = useCallback(
        (searchText: string) => overviewApi.searchCouriers(searchText),
        [],
    );

    /*
     * The control emits the whole selection; the parent still speaks add/remove,
     * so the difference is derived here rather than widening its contract.
     */
    const handleCouriersChange = useCallback((items: ISuggestion[]) => {
        const nextIds = new Set(items.map((item) => item.id));
        for (const item of items) {
            if (!selectedCouriers.some((existing) => existing.id === item.id)) {
                onAddCourier(item);
            }
        }
        for (const existing of selectedCouriers) {
            if (!nextIds.has(existing.id)) {
                onRemoveCourier(existing.id);
            }
        }
    }, [selectedCouriers, onAddCourier, onRemoveCourier]);
    const {ensureDateRangeDialog} = useDialogLoader();

    const hasDateFilter = dateRange.start != null || dateRange.end != null;

    /*
     * What Clear all would actually clear. It labels the button so the reset is
     * quantified before it is pressed, and disables it when there is nothing to
     * undo — the control keeps its place either way, so it is always where the
     * reader last saw it.
     */
    const activeCriteriaCount =
        (hasDateFilter ? 1 : 0)
        + selectedRegionIds.size
        + selectedSpeedIds.size
        + selectedCouriers.length;

    const getDateRangeDisplay = useCallback((): string => {
        if (!hasDateFilter) return '';
        if (dateRange.start && dateRange.end) {
            return `${dayjs(dateRange.start).format('MMM D, YYYY')} - ${dayjs(dateRange.end).format('MMM D, YYYY')}`;
        }
        if (dateRange.start) return `From ${dayjs(dateRange.start).format('MMM D, YYYY')}`;
        return `Until ${dayjs(dateRange.end).format('MMM D, YYYY')}`;
    }, [dateRange, hasDateFilter]);

    const handleOpenDateDialog = useCallback(async () => {
        // The date-range dialog ships as a separate lazy-loaded bundle; ensure it
        // is loaded (registering window.ReactDateRangeDialog) before opening it.
        await ensureDateRangeDialog();
        const result = await window.ReactDateRangeDialog?.open({
            start: dateRange.start,
            end: dateRange.end,
        });
        if (result) {
            onDateRangeChange({start: result.start, end: result.end});
        }
    }, [dateRange, onDateRangeChange, ensureDateRangeDialog]);

    const handleClearDateRange = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDateRangeChange({});
        },
        [onDateRangeChange],
    );

    return (
        <Card withBorder p={0} h="100%" style={{display: 'flex', flexDirection: 'column'}}>
            <PanelHeader
                icon={<SymbolIcon name="tune" />}
                title="Quick Filters"
            />
            {/*
              * One scrolling column of labelled criteria, matching job search's
              * Search Criteria panel. No per-section header bars: the panel is
              * named once above, and six section bars would out-shout the
              * controls they introduce.
              */}
            <Stack
                gap={CRITERION_GAP}
                p={CRITERION_GAP}
                style={{flex: 1, minHeight: 0, overflowY: 'auto', boxSizing: 'border-box'}}
            >
                {/* Date Range */}
                <Stack gap={CRITERION_LABEL_GAP} miw={0}>
                    <GroupLabel selected={hasDateFilter ? 1 : 0}>Date range</GroupLabel>
                    <Button
                        size="xs"
                        h={34}
                        fullWidth
                        variant={hasDateFilter ? 'filled' : 'default'}
                        onClick={handleOpenDateDialog}
                        justify="flex-start"
                        leftSection={<SymbolIcon name={hasDateFilter ? 'calendar_month' : 'date_range'} size={18} />}
                        rightSection={
                            hasDateFilter ? (
                                <ActionIcon
                                    component="span"
                                    variant="transparent"
                                    c="inherit"
                                    size="sm"
                                    onClick={handleClearDateRange}
                                    aria-label="Clear date range"
                                >
                                    <SymbolIcon name="close" size={18} />
                                </ActionIcon>
                            ) : undefined
                        }
                    >
                        {hasDateFilter ? getDateRangeDisplay() : 'Select dates'}
                    </Button>
                </Stack>

                {/*
                  * A divider between groups, not between the options inside one.
                  * Two adjacent checkbox grids are exactly the case where
                  * whitespace alone stops reading as a boundary — a region and a
                  * speed look identical and sit flush together.
                  */}
                <Divider role="separator"/>

                {/* Regions */}
                <Stack gap={CRITERION_LABEL_GAP} miw={0}>
                    <Group justify="space-between" align="center" wrap="nowrap">
                        <GroupLabel selected={selectedRegionIds.size}>Regions</GroupLabel>
                        <SelectAllToggle
                            checked={allRegionsSelected}
                            onChange={onToggleAllRegions}
                            label="regions"
                        />
                    </Group>
                    {regionsLoading ? (
                        <Progress.Root size={4} radius={0}>
                            <Progress.Section value={100} animated aria-label="Loading regions"/>
                        </Progress.Root>
                    ) : regions.length === 0 ? (
                        <Text fz="xs" c="dimmed">No regions found</Text>
                    ) : (
                        <SimpleGrid cols={2} spacing={4} verticalSpacing={10} mah={168} style={{overflowY: 'auto'}}>
                            {regions.map((region) => (
                                <Checkbox
                                    key={region.id}
                                    size="xs"
                                    checked={selectedRegionIds.has(region.id)}
                                    onChange={() => onToggleRegion(region.id)}
                                    label={<Text fz="sm">{region.text}</Text>}
                                />
                            ))}
                        </SimpleGrid>
                    )}
                </Stack>

                <Divider role="separator"/>

                {/* Speeds */}
                <Stack gap={CRITERION_LABEL_GAP} miw={0}>
                    <Group justify="space-between" align="center" wrap="nowrap">
                        <GroupLabel selected={selectedSpeedIds.size}>Speeds</GroupLabel>
                        <SelectAllToggle
                            checked={allSpeedsSelected}
                            onChange={onToggleAllSpeeds}
                            label="speeds"
                        />
                    </Group>
                    {speedsLoading ? (
                        <Progress.Root size={4} radius={0}>
                            <Progress.Section value={100} animated aria-label="Loading speeds"/>
                        </Progress.Root>
                    ) : speeds.length === 0 ? (
                        <Text fz="xs" c="dimmed">No speeds found</Text>
                    ) : (
                        <SimpleGrid cols={2} spacing={4} verticalSpacing={10} mah={168} style={{overflowY: 'auto'}}>
                            {speeds.map((speed) => (
                                <Checkbox
                                    key={speed.id}
                                    size="xs"
                                    checked={selectedSpeedIds.has(speed.id)}
                                    onChange={() => onToggleSpeed(speed.id)}
                                    label={<Text fz="sm">{speed.text}</Text>}
                                />
                            ))}
                        </SimpleGrid>
                    )}
                </Stack>

                <Divider role="separator"/>

                {/* Couriers */}
                <Stack gap={CRITERION_LABEL_GAP} miw={0}>
                    <GroupLabel selected={selectedCouriers.length}>Couriers</GroupLabel>
                    {/*
                      * The same chip field job search uses for Clients, Couriers and
                      * Speeds. It replaces a hand-rolled Autocomplete plus a row of
                      * removable Badges, and brings the debounce, the stale-response
                      * guard and the label cache with it.
                      */}
                    <ChipsAutocomplete
                        label="Couriers"
                        placeholder="Search couriers..."
                        value={selectedCouriers}
                        minInputLength={1}
                        onSearch={searchCouriers}
                        onChange={handleCouriersChange}
                    />
                </Stack>
            </Stack>

            {/*
              * The foot. Baymard's guidance is that a reset belongs in a
              * consistent, predictable place — conventionally the panel's foot —
              * so it is pinned below the scrolling criteria rather than sitting
              * at the end of them, where it would drift out of view.
              */}
            <Group
                px={CRITERION_GAP}
                py="xs"
                justify="flex-end"
                style={{
                    flexShrink: 0,
                    borderTop: '1px solid var(--mantine-color-default-border)',
                }}
            >
                <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    disabled={activeCriteriaCount === 0}
                    onClick={onClearAll}
                    leftSection={<SymbolIcon name="filter_alt_off" size={16} />}
                >
                    {activeCriteriaCount > 0 ? `Clear all (${activeCriteriaCount})` : 'Clear all'}
                </Button>
            </Group>
        </Card>
    );
};

export default FilterPanel;
