/**
 * SearchCriteriaPanel Component
 *
 * React replacement for the entire pickDate.html AngularJS template.
 * Composes DateRangePicker, ChipsAutocomplete inputs, text search fields,
 * and action buttons into a single panel.
 *
 * Date values are held locally and only flushed to the parent when the user
 * triggers a date-driven action (search, download, or either report).  This
 * prevents the AngularJS digest cycle from re-rendering the React tree and
 * resetting the date field mid-typing.  Each action also receives the flushed
 * dates directly — see `SearchActionDates`.
 */

import React, {useState, useCallback, useEffect} from 'react';
import {
    ActionIcon, Box, Button, Collapse, Group, Stack, Text, TextInput, Tooltip, UnstyledButton,
} from '@mantine/core';
import {ChevronDown, Download, FileText, ReceiptText, Upload} from 'lucide-react';
import {Icon} from '../icon/Icon';
import classes from './SearchCriteriaPanel.module.css';
import {Dayjs} from 'dayjs';
import {DateRangePicker} from '../date-range-picker/DateRangePicker';
import {ChipsAutocomplete} from './ChipsAutocomplete';
import {ISuggestion} from '../../../../interfaces/job.interface';

/**
 * The dates a date-driven action was fired with. Handed to the action directly
 * because the matching `onFromDateChange`/`onToDateChange` commit is a React
 * state update in the same tick — the parent cannot read it back yet.
 */
export interface SearchActionDates {
    fromDate?: Dayjs;
    toDate?: Dayjs;
}

export interface SearchCriteriaPanelProps {
    // Controlled state (from AngularJS via bridge)
    dateSearchRange: string;
    fromDate: Dayjs;
    toDate: Dayjs;
    // Callbacks
    onSearchRangeChange: (range: string) => void;
    onFromDateChange: (dateTime: Dayjs) => void;
    onToDateChange: (dateTime: Dayjs) => void;
    onCriteriaChange: (field: string, value: ISuggestion[] | string | number | undefined) => void;
    onSearch: (dates?: SearchActionDates) => void;
    onDownload: (dates?: SearchActionDates) => void;
    onClientReport: (dates?: SearchActionDates) => void;
    onPriceDetailReport: (dates?: SearchActionDates) => void;
    onUpload: (event: React.MouseEvent) => void;
    onClientSearch: (searchText: string) => Promise<ISuggestion[]>;
    onCourierSearch: (searchText: string) => Promise<ISuggestion[]>;
    onSpeedSearch: (searchText: string) => Promise<ISuggestion[]>;
}

/** The quiet caption above each criterion group. */
const groupLabelProps = {
    fz: '0.625rem',
    fw: 500,
    c: 'dimmed',
    tt: 'uppercase',
    lh: 2.5,
    style: {letterSpacing: '0.08333em'},
} as const;

/**
 * The compact field every criterion uses. The MUI original reached into
 * `.MuiOutlinedInput-*` to set the height, font and border; Mantine's `xs` size
 * and the theme's input styling already give all three, so only the exact 34px
 * height (which the panel's density depends on) has to be stated.
 */
const criteriaFieldProps = {
    size: 'xs',
    styles: {input: {height: 34, minHeight: 34, fontSize: '0.8125rem'}},
} as const;

/** The four square icon actions in the footer. */
const actionProps = {
    variant: 'subtle',
    color: 'gray',
    w: 36,
    h: 36,
} as const;

export const SearchCriteriaPanel: React.FC<SearchCriteriaPanelProps> = ({
    dateSearchRange,
    fromDate,
    toDate,
    onSearchRangeChange,
    onFromDateChange,
    onToDateChange,
    onCriteriaChange,
    onSearch,
    onDownload,
    onClientReport,
    onPriceDetailReport,
    onUpload,
    onClientSearch,
    onCourierSearch,
    onSpeedSearch,
}) => {
    // Local date state — only flushed to AngularJS on search
    const [localFromDate, setLocalFromDate] = useState<Dayjs>(fromDate);
    const [localToDate, setLocalToDate] = useState<Dayjs>(toDate);

    // Sync from parent when preset range buttons change the dates
    useEffect(() => { setLocalFromDate(fromDate); }, [fromDate]);
    useEffect(() => { setLocalToDate(toDate); }, [toDate]);

    // Local state for chips and text inputs
    const [clients, setClients] = useState<ISuggestion[]>([]);
    const [couriers, setCouriers] = useState<ISuggestion[]>([]);
    const [speeds, setSpeeds] = useState<ISuggestion[]>([]);
    const [jobId, setJobId] = useState('');
    const [bulkJobId, setBulkJobId] = useState('');
    const [jobNumber, setJobNumber] = useState('');
    const [generalSearch, setGeneralSearch] = useState('');
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const isClientReportEnabled = clients.length > 0 && !!localFromDate && !!localToDate;

    // Commit the local dates upward and return them, so the action that follows
    // in this same tick uses them without waiting for the commit to land.
    const flushDates = useCallback((): SearchActionDates => {
        const fromDate = localFromDate?.isValid() ? localFromDate : undefined;
        const toDate = localToDate?.isValid() ? localToDate : undefined;
        if (fromDate) onFromDateChange(fromDate);
        if (toDate) onToDateChange(toDate);
        return {fromDate, toDate};
    }, [localFromDate, localToDate, onFromDateChange, onToDateChange]);

    const flushAndSearch = useCallback(() => {
        onSearch(flushDates());
    }, [flushDates, onSearch]);

    const flushAndDownload = useCallback(() => {
        onDownload(flushDates());
    }, [flushDates, onDownload]);

    const flushAndClientReport = useCallback(() => {
        onClientReport(flushDates());
    }, [flushDates, onClientReport]);

    const flushAndPriceDetailReport = useCallback(() => {
        onPriceDetailReport(flushDates());
    }, [flushDates, onPriceDetailReport]);

    // Chip change handlers — update local state + sync to AngularJS
    const handleClientsChange = useCallback((items: ISuggestion[]) => {
        setClients(items);
        onCriteriaChange('clients', items);
    }, [onCriteriaChange]);

    const handleCouriersChange = useCallback((items: ISuggestion[]) => {
        setCouriers(items);
        onCriteriaChange('couriers', items);
    }, [onCriteriaChange]);

    const handleSpeedsChange = useCallback((items: ISuggestion[]) => {
        setSpeeds(items);
        onCriteriaChange('speeds', items);
    }, [onCriteriaChange]);

    // Text input change handlers
    const handleJobIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setJobId(value);
        onCriteriaChange('jobId', value ? Number(value) : undefined);
    }, [onCriteriaChange]);

    const handleBulkJobIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setBulkJobId(value);
        onCriteriaChange('bulkJobId', value ? Number(value) : undefined);
    }, [onCriteriaChange]);

    const handleJobNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setJobNumber(value);
        onCriteriaChange('job', value || undefined);
    }, [onCriteriaChange]);

    const handleGeneralSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setGeneralSearch(value);
        onCriteriaChange('wild', value || undefined);
    }, [onCriteriaChange]);

    // Enter key triggers search
    const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            flushAndSearch();
        }
    }, [flushAndSearch]);

    return (
        <Stack gap={16} p={16} h="100%" style={{boxSizing: 'border-box', overflowY: 'auto'}}>
            {/* Date Range */}
            <Stack gap={6} miw={0}>
                <Text {...groupLabelProps}>Date Range</Text>
                <DateRangePicker
                    dateSearchRange={dateSearchRange}
                    fromDate={localFromDate}
                    toDate={localToDate}
                    onSearchRangeChange={onSearchRangeChange}
                    onFromDateChange={setLocalFromDate}
                    onToDateChange={setLocalToDate}
                />
            </Stack>

            {/* Clients */}
            <Stack gap={6} miw={0}>
                <Text {...groupLabelProps}>Clients</Text>
                <ChipsAutocomplete
                    label="Clients"
                    placeholder="Search clients..."
                    value={clients}
                    minInputLength={2}
                    onSearch={onClientSearch}
                    onChange={handleClientsChange}
                />
            </Stack>

            {/* Couriers */}
            <Stack gap={6} miw={0}>
                <Text {...groupLabelProps}>Couriers</Text>
                <ChipsAutocomplete
                    label="Couriers"
                    placeholder="Search couriers..."
                    value={couriers}
                    minInputLength={1}
                    onSearch={onCourierSearch}
                    onChange={handleCouriersChange}
                />
            </Stack>

            {/* Speeds */}
            <Stack gap={6} miw={0}>
                <Text {...groupLabelProps}>Speeds</Text>
                <ChipsAutocomplete
                    label="Speeds"
                    placeholder="Search speeds..."
                    value={speeds}
                    minInputLength={1}
                    onSearch={onSpeedSearch}
                    onChange={handleSpeedsChange}
                />
            </Stack>

            {/* Job Number */}
            <Stack gap={6} miw={0}>
                <Text {...groupLabelProps}>Job Number</Text>
                <TextInput
                    {...criteriaFieldProps}
                    placeholder="Enter job number"
                    value={jobNumber}
                    onChange={handleJobNumberChange}
                    onKeyUp={handleKeyUp}
                />
            </Stack>

            {/* General Search */}
            <Stack gap={6} miw={0}>
                <Text {...groupLabelProps}>General Search</Text>
                <TextInput
                    {...criteriaFieldProps}
                    placeholder="Address, name, reference..."
                    value={generalSearch}
                    onChange={handleGeneralSearchChange}
                    onKeyUp={handleKeyUp}
                />
            </Stack>

            {/* Advanced Options */}
            <Box>
                <UnstyledButton
                    onClick={() => setAdvancedOpen(prev => !prev)}
                    className={classes.advancedToggle}
                >
                    <Text component="span" fz="xs" c="dimmed">Advanced</Text>
                    <Icon
                        lucide={ChevronDown}
                        size={18}
                        className={classes.advancedChevron}
                        data-open={advancedOpen}
                    />
                </UnstyledButton>
                <Collapse expanded={advancedOpen}>
                    <Stack gap={12} mt={8}>
                        <Stack gap={6}>
                            <Text {...groupLabelProps}>Job ID</Text>
                            <TextInput
                                {...criteriaFieldProps}
                                type="number"
                                placeholder="Enter job ID"
                                value={jobId}
                                disabled={!!bulkJobId}
                                onChange={handleJobIdChange}
                                onKeyUp={handleKeyUp}
                            />
                        </Stack>
                        <Stack gap={6}>
                            <Text {...groupLabelProps}>Bulk Job ID</Text>
                            <TextInput
                                {...criteriaFieldProps}
                                type="number"
                                placeholder="Enter bulk job ID"
                                value={bulkJobId}
                                disabled={!!jobId}
                                onChange={handleBulkJobIdChange}
                                onKeyUp={handleKeyUp}
                            />
                        </Stack>
                    </Stack>
                </Collapse>
            </Box>

            {/* Actions */}
            <Group
                gap={8}
                wrap="wrap"
                mt="auto"
                pt={16}
                style={{borderTop: '1px solid var(--mantine-color-default-border)'}}
            >
                <Button onClick={flushAndSearch} h={36} miw={100} style={{flex: '1 1 auto'}}>
                    Search
                </Button>
                <Group gap={4} wrap="nowrap">
                    <Tooltip label="Download">
                        <ActionIcon {...actionProps} onClick={flushAndDownload} aria-label="Download">
                            <Icon lucide={Download} size={20} />
                        </ActionIcon>
                    </Tooltip>
                    {/* The <span> keeps the tooltip reachable while the button is
                        disabled — a disabled button fires no pointer events. */}
                    <Tooltip label="Client Report">
                        <span>
                            <ActionIcon
                                {...actionProps}
                                onClick={flushAndClientReport}
                                disabled={!isClientReportEnabled}
                                aria-label="Client Report"
                            >
                                <Icon lucide={FileText} size={20} />
                            </ActionIcon>
                        </span>
                    </Tooltip>
                    <Tooltip label="Price Detail Report">
                        <ActionIcon {...actionProps} onClick={flushAndPriceDetailReport} aria-label="Price Detail Report">
                            <Icon lucide={ReceiptText} size={20} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Upload Prices">
                        <ActionIcon {...actionProps} onClick={onUpload} aria-label="Upload Prices">
                            <Icon lucide={Upload} size={20} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>
        </Stack>
    );
};

export default SearchCriteriaPanel;
