/**
 * Job List Toolbar
 *
 * Category filter tabs, search input, density mode selector, and reset button.
 * Follows the app's standard toolbar pattern (44px minHeight, divider border).
 */

import React, {useCallback, useRef} from 'react';
import {Box, Group, Text, TextInput} from '@mantine/core';
import {useDebouncedCallback} from '@mantine/hooks';
import {ArchiveRestore, Mail, MailOpen, Search, X} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';

import {Icon} from '../common/icon/Icon';
import {ActionButton, ACTION_BUTTON_GLYPH_SIZE} from '../common/action-button';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../common/panel-controls';
import {SegmentedToggle} from '../common/segmented-toggle';
import type {JobCategory, DensityMode} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import {JobListViewOptions} from './JobListViewOptions';

interface JobListToolbarProps {
    selectedCategory: JobCategory;
    onCategoryChange: (category: JobCategory) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    loggedInCouriersOnly: boolean;
    onLoggedInCouriersOnlyChange: (checked: boolean) => void;
    densityMode: DensityMode;
    onDensityModeChange: (mode: DensityMode) => void;
    onResetColumns: () => void;
    onEditColumns: () => void;
    appPage?: AppPage | number;
    selectedCount?: number;
    onClearSelection?: () => void;
    /** Opens the universal dispatch dialog in bulk mode. */
    onBulkDispatchClick?: () => void;
    onBulkRestore?: () => void;
    onBulkMarkRead?: () => void;
    onBulkMarkUnread?: () => void;
    /** Owned by JobListPanel — the switch is live-dispatch-only. */
    showLoggedInSwitch?: boolean;
    /**
     * Render the view options (density / reset columns / logged-in toggle) inline
     * in the toolbar. Set false when they're relocated to the panel header.
     * Defaults to true.
     */
    renderViewOptions?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;

const CATEGORY_OPTIONS: {value: JobCategory; label: string}[] = [
    {value: 'needs-dispatch', label: 'Unassigned'},
    {value: 'in-progress', label: 'Active'},
    {value: 'delivered', label: 'Done'},
    {value: 'all', label: 'All'},
];

/**
 * The active tab keeps its category's semantic colour — Unassigned/Active/Done
 * encode real state, so the colour is information, not decoration. Only the
 * indicator is tinted, so the accent follows the current selection rather than
 * being set per option.
 */
const CATEGORY_COLORS: Record<JobCategory, string> = {
    'needs-dispatch': 'orange',
    'in-progress': 'reflex',
    delivered: 'green',
    all: 'brand',
};

// 48 is what both bars measure — 8px padding around the 32px control band. They
// have to agree: the selection bar replaces the toolbar in place, and a
// disagreement shifts the whole table down every time a row is ticked.
const BAR_MIN_HEIGHT = 48;

const containerStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--mantine-color-default-border)',
    backgroundColor: 'var(--dd-surface-container)',
    minHeight: BAR_MIN_HEIGHT,
};

const selectionBarStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--mantine-color-default-border)',
    backgroundColor: 'var(--mantine-color-brand-light)',
    minHeight: BAR_MIN_HEIGHT,
};

export const JobListToolbar: React.FC<JobListToolbarProps> = ({
    selectedCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
    loggedInCouriersOnly,
    onLoggedInCouriersOnlyChange,
    densityMode,
    onDensityModeChange,
    onResetColumns,
    onEditColumns,
    appPage,
    selectedCount = 0,
    onClearSelection,
    onBulkDispatchClick,
    onBulkRestore,
    onBulkMarkRead,
    onBulkMarkUnread,
    showLoggedInSwitch,
    renderViewOptions = true,
}) => {
    // Every operational page can bulk-dispatch; Nationwide was previously excluded,
    // which left it with no bulk assignment affordance at all.
    const allowDispatch = appPage === AppPage.Dispatch
        || appPage === AppPage.JobSearch
        || appPage === AppPage.Domestic;
    const localInputRef = useRef(searchQuery);

    // useDebouncedCallback owns the timer and clears it on unmount.
    const emitSearch = useDebouncedCallback(onSearchChange, SEARCH_DEBOUNCE_MS);

    const handleSearchInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            localInputRef.current = value;
            emitSearch(value);
        },
        [emitSearch],
    );

    // Selection action bar
    if (selectedCount > 0) {
        return (
            <Group align="center" gap="xs" px="md" py="xs" wrap="wrap" style={selectionBarStyle}>
                <HeaderActionIcon label="Clear selection" onClick={onClearSelection}>
                    <Icon lucide={X} size={PANEL_CONTROL_GLYPH_SIZE}/>
                </HeaderActionIcon>
                <Text size="sm" fw={600} mr="md">
                    {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
                </Text>

                {/*
                  * Dispatch is the action people select rows for, so it is the
                  * bar's one filled lozenge; everything else stays a raised chip.
                  */}
                {allowDispatch && (
                    <ActionButton
                        variant="filled"
                        leftSection={<Icon tabler={IconTruck} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                        onClick={onBulkDispatchClick}
                    >
                        Dispatch
                    </ActionButton>
                )}

                {allowDispatch && (
                    <ActionButton leftSection={<Icon lucide={ArchiveRestore} size={ACTION_BUTTON_GLYPH_SIZE}/>} onClick={onBulkRestore}>
                        Restore
                    </ActionButton>
                )}

                <ActionButton leftSection={<Icon lucide={MailOpen} size={ACTION_BUTTON_GLYPH_SIZE}/>} onClick={onBulkMarkRead}>
                    Mark Read
                </ActionButton>
                <ActionButton leftSection={<Icon lucide={Mail} size={ACTION_BUTTON_GLYPH_SIZE}/>} onClick={onBulkMarkUnread}>
                    Mark Unread
                </ActionButton>
            </Group>
        );
    }

    return (
        <Group align="center" gap="sm" px="md" py="xs" wrap="wrap" style={containerStyle}>
            {/* Category filter tabs */}
            <SegmentedToggle<JobCategory>
                aria-label="Job category"
                value={selectedCategory}
                onChange={onCategoryChange}
                color={CATEGORY_COLORS[selectedCategory]}
                data={CATEGORY_OPTIONS}
            />

            {/* Search */}
            <TextInput
                size="xs"
                placeholder="Search jobs..."
                defaultValue={searchQuery}
                onChange={handleSearchInput}
                leftSection={<Icon lucide={Search} size={16} color="var(--mantine-color-gray-5)"/>}
                style={{flex: '1 1 160px', maxWidth: 280}}
            />

            <Box style={{flex: 1}}/>

            {/* View options — relocated to the panel header on the dispatch page
                (renderViewOptions=false); rendered inline elsewhere. */}
            {renderViewOptions && (
                <JobListViewOptions
                    densityMode={densityMode}
                    onDensityModeChange={onDensityModeChange}
                    onResetColumns={onResetColumns}
                    onEditColumns={onEditColumns}
                    loggedInCouriersOnly={loggedInCouriersOnly}
                    onLoggedInCouriersOnlyChange={onLoggedInCouriersOnlyChange}
                    showLoggedInSwitch={showLoggedInSwitch}
                />
            )}
        </Group>
    );
};
