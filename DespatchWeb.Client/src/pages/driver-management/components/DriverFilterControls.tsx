import React, {type Dispatch, type SetStateAction} from 'react';
import {Select, Stack} from '@mantine/core';
import {Download, RefreshCw} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
import {
    CRITERION_LABEL_GAP,
    FILTER_CONTROL_HEIGHT,
    GroupLabel,
} from '../../../components/common/filter-fields';
import {FleetOption, PaginatedRequest} from '../../../types';
import {SearchField} from './shared';

interface FilterSelectProps {
    label: string;
    selected: boolean;
    value: string;
    data: {value: string; label: string}[];
    onChange: (value: string | null) => void;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({label, selected, value, data, onChange}) => (
    <Stack gap={CRITERION_LABEL_GAP}>
        <GroupLabel selected={selected ? 1 : 0}>{label}</GroupLabel>
        <Select
            size="xs"
            aria-label={label}
            miw={150}
            allowDeselect={false}
            styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
            value={value}
            onChange={onChange}
            data={data}
        />
    </Stack>
);

interface FleetFilterProps {
    fleet: number;
    fleetOptions: FleetOption[];
    onChange: (fleet: number) => void;
}

export const FleetFilter: React.FC<FleetFilterProps> = ({fleet, fleetOptions, onChange}) => (
    <FilterSelect
        label="Fleet"
        selected={!!fleet}
        value={String(fleet)}
        onChange={(value) => onChange(Number(value ?? 0))}
        data={[
            {value: '0', label: 'All fleets'},
            ...fleetOptions.map(opt => ({value: String(opt.id), label: opt.text})),
        ]}
    />
);

interface QuerySearchFieldProps {
    query: PaginatedRequest;
    setQuery: React.Dispatch<React.SetStateAction<PaginatedRequest>>;
    placeholder: string;
}

export const QuerySearchField: React.FC<QuerySearchFieldProps> = ({query, setQuery, placeholder}) => (
    <SearchField
        value={query.searchTerm ?? ''}
        onChange={(value) => setQuery(q => ({...q, searchTerm: value, page: 1}))}
        placeholder={placeholder}
    />
);

export const ExportCsvAction: React.FC<{onClick: () => void}> = ({onClick}) => (
    <HeaderActionIcon label="Export CSV" onClick={onClick}>
        <Icon lucide={Download} size={PANEL_CONTROL_GLYPH_SIZE}/>
    </HeaderActionIcon>
);

export const RefreshExportActions: React.FC<{onRefresh: () => void; onExport: () => void}> = ({onRefresh, onExport}) => (
    <>
        <HeaderActionIcon label="Refresh" onClick={onRefresh}>
            <Icon lucide={RefreshCw} size={PANEL_CONTROL_GLYPH_SIZE}/>
        </HeaderActionIcon>
        <ExportCsvAction onClick={onExport}/>
    </>
);

/** Merges a filter change and sends the list back to page 1. */
export function filterUpdater<F>(
    setFilters: Dispatch<SetStateAction<F>>,
    setQuery: Dispatch<SetStateAction<PaginatedRequest>>,
): (patch: Partial<F>) => void {
    return (patch) => {
        setFilters(f => ({...f, ...patch}));
        setQuery(q => ({...q, page: 1}));
    };
}
