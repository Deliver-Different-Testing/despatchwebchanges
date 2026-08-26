import React, {useState, useCallback} from 'react';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import dayjs from 'dayjs';
import type {ISuggestion, DateRange} from '../OverviewPage.interfaces';
import {useCourierSearch} from '../../../hooks/useOverviewApi';
import {PanelHeader} from '../../../components/common/panel-header';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import {useDialogLoader} from '../../../components/common/job-details/hooks/useDialogLoader';

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
}

const ToolbarHeader: React.FC<{icon: string; title: string; actions?: React.ReactNode}> = ({
    icon,
    title,
    actions,
}) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2,
            py: 0.75,
            bgcolor: 'grey.100',
            color: 'text.primary',
            borderTop: 1,
            borderColor: 'divider',
            minHeight: 36,
        }}
    >
        <SymbolIcon name={icon} size={18} />
        <Typography variant="caption" sx={{ml: 1, flex: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em'}}>
            {title}
        </Typography>
        {actions}
    </Box>
);

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
}) => {
    const [courierSearchText, setCourierSearchText] = useState('');
    const {data: courierResults, isLoading: couriersLoading} = useCourierSearch(courierSearchText);
    const {ensureDateRangeDialog} = useDialogLoader();

    const hasDateFilter = dateRange.start != null || dateRange.end != null;

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

    // Filter out already-selected couriers from autocomplete options
    const courierOptions = (courierResults ?? []).filter(
        (c) => !selectedCouriers.some((sc) => sc.id === c.id),
    );

    return (
        <Card variant="outlined">
            <PanelHeader
                icon={<SymbolIcon name="tune" />}
                title="Quick Filters"
            />
            {/* Date Range */}
            <ToolbarHeader icon="date_range" title="Date Range" />
            <Box sx={{p: 2}}>
                <Button
                    fullWidth
                    variant={hasDateFilter ? 'contained' : 'outlined'}
                    onClick={handleOpenDateDialog}
                    startIcon={
                        <SymbolIcon name={hasDateFilter ? 'calendar_month' : 'date_range'} />
                    }
                    endIcon={
                        hasDateFilter ? (
                            <IconButton size="small" onClick={handleClearDateRange} sx={{color: 'inherit', p: 0}}>
                                <SymbolIcon name="close" size={18} />
                            </IconButton>
                        ) : undefined
                    }
                    sx={{justifyContent: 'flex-start', textTransform: 'none'}}
                >
                    {hasDateFilter ? getDateRangeDisplay() : 'Select Dates'}
                </Button>
            </Box>
            {/* Regions */}
            <ToolbarHeader
                icon="public_off"
                title="Regions"
                actions={
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={allRegionsSelected}
                                onChange={onToggleAllRegions}
                                size="small"
                                color="primary"
                            />
                        }
                        label={
                            <Typography variant="caption" sx={{
                                color: "text.secondary"
                            }}>
                                {allRegionsSelected ? 'Unselect All' : 'Select All'}
                            </Typography>
                        }
                    />
                }
            />
            {regionsLoading && <LinearProgress />}
            {!regionsLoading && (
                <Box sx={{p: 2}}>
                    {regions.length === 0 ? (
                        <Box sx={{textAlign: 'center', py: 2, color: 'text.secondary'}}>
                            <SymbolIcon name="public_off" size={36} />
                            <Typography variant="body2">No regions found</Typography>
                        </Box>
                    ) : (
                        <Box sx={{display: 'flex', flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto'}}>
                            {regions.map((region) => (
                                <Box key={region.id} sx={{width: '50%'}}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={selectedRegionIds.has(region.id)}
                                                onChange={() => onToggleRegion(region.id)}
                                                size="small"
                                                color="primary"
                                            />
                                        }
                                        label={<Typography variant="body2">{region.text}</Typography>}
                                    />
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
            {/* Speeds */}
            <ToolbarHeader
                icon="speed"
                title="Speeds"
                actions={
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={allSpeedsSelected}
                                onChange={onToggleAllSpeeds}
                                size="small"
                                color="primary"
                            />
                        }
                        label={
                            <Typography variant="caption" sx={{
                                color: "text.secondary"
                            }}>
                                {allSpeedsSelected ? 'Unselect All' : 'Select All'}
                            </Typography>
                        }
                    />
                }
            />
            {speedsLoading && <LinearProgress />}
            {!speedsLoading && (
                <Box sx={{p: 2}}>
                    {speeds.length === 0 ? (
                        <Box sx={{textAlign: 'center', py: 2, color: 'text.secondary'}}>
                            <SymbolIcon name="speed" size={36} />
                            <Typography variant="body2">No speeds found</Typography>
                        </Box>
                    ) : (
                        <Box sx={{display: 'flex', flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto'}}>
                            {speeds.map((speed) => (
                                <Box key={speed.id} sx={{width: '50%'}}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={selectedSpeedIds.has(speed.id)}
                                                onChange={() => onToggleSpeed(speed.id)}
                                                size="small"
                                                color="primary"
                                            />
                                        }
                                        label={<Typography variant="body2">{speed.text}</Typography>}
                                    />
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
            {/* Couriers */}
            <ToolbarHeader icon="local_shipping" title="Couriers" />
            <Box sx={{p: 2}}>
                <Autocomplete
                    size="small"
                    options={courierOptions}
                    getOptionLabel={(o) => o.text}
                    loading={couriersLoading}
                    inputValue={courierSearchText}
                    onInputChange={(_e, value) => setCourierSearchText(value)}
                    onChange={(_e, value) => {
                        if (value) {
                            onAddCourier(value);
                            setCourierSearchText('');
                        }
                    }}
                    value={null}
                    noOptionsText={
                        courierSearchText ? `No couriers found matching "${courierSearchText}"` : 'Type to search...'
                    }
                    renderInput={({slotProps: autoSlotProps, ...params}) => (
                        <TextField
                            {...params}
                            label="Search couriers..."
                            slotProps={{
                                ...autoSlotProps,
                                input: {
                                    ...autoSlotProps.input,
                                    endAdornment: (
                                        <>
                                            {couriersLoading ? <CircularProgress size={20} /> : null}
                                            {autoSlotProps.input.endAdornment}
                                        </>
                                    ),
                                },
                            }}
                        />
                    )}
                />

                {selectedCouriers.length > 0 && (
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1}}>
                        {selectedCouriers.map((courier) => (
                            <Chip
                                key={courier.id}
                                label={courier.text}
                                onDelete={() => onRemoveCourier(courier.id)}
                                size="small"
                            />
                        ))}
                    </Box>
                )}
            </Box>
        </Card>
    );
};

export default FilterPanel;
