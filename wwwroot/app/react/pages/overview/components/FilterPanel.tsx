import React, {useState, useCallback} from 'react';
import {alpha} from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material';
import dayjs from 'dayjs';
import type {ISuggestion, DateRange} from '../OverviewPage.interfaces';
import {useCourierSearch} from '../../../hooks/useOverviewApi';

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

const cardHeaderStyle: SxProps<Theme> = (theme: Theme) => ({
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    minHeight: 40,
    px: 1.25,
    gap: 0.5,
    flexShrink: 0,
    boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}`,
    '& .MuiIconButton-root': {
        color: 'inherit',
        p: 0.5,
        borderRadius: 1,
        transition: 'background-color 150ms ease, transform 150ms ease',
        '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.15),
        },
        '&:active': {
            transform: 'scale(0.92)',
        },
    },
});

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
        <span className="material-symbols-outlined" style={{fontSize: 18}}>
            {icon}
        </span>
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
        if (!window.ReactDateRangeDialog) {
            console.warn('[FilterPanel] ReactDateRangeDialog not available');
            return;
        }
        const result = await window.ReactDateRangeDialog.open({
            start: dateRange.start,
            end: dateRange.end,
        });
        if (result) {
            onDateRangeChange({start: result.start, end: result.end});
        }
    }, [dateRange, onDateRangeChange]);

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
        <Card variant="outlined" sx={{borderRadius: 1.5, border: 1, borderColor: 'divider', boxShadow: 1}}>
            {/* Card Header */}
            <Toolbar variant="dense" disableGutters sx={cardHeaderStyle}>
                <Icon sx={{fontSize: 20, mr: 0.75, opacity: 0.9}} baseClassName="material-symbols-outlined">tune</Icon>
                <Typography variant="subtitle2" noWrap sx={{fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.01em'}}>
                    Quick Filters
                </Typography>
            </Toolbar>

            {/* Date Range */}
            <ToolbarHeader icon="date_range" title="Date Range" />
            <Box sx={{p: 2}}>
                <Button
                    fullWidth
                    variant={hasDateFilter ? 'contained' : 'outlined'}
                    onClick={handleOpenDateDialog}
                    startIcon={
                        <span className="material-symbols-outlined">
                            {hasDateFilter ? 'calendar_month' : 'date_range'}
                        </span>
                    }
                    endIcon={
                        hasDateFilter ? (
                            <IconButton size="small" onClick={handleClearDateRange} sx={{color: 'inherit', p: 0}}>
                                <span className="material-symbols-outlined" style={{fontSize: 18}}>
                                    close
                                </span>
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
                            <Typography variant="caption" color="text.secondary">
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
                            <span className="material-symbols-outlined" style={{fontSize: 36, display: 'block'}}>
                                public_off
                            </span>
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
                            <Typography variant="caption" color="text.secondary">
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
                            <span className="material-symbols-outlined" style={{fontSize: 36, display: 'block'}}>
                                speed
                            </span>
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
                    renderInput={({InputProps: autoInputProps, ...params}) => (
                        <TextField
                            {...params}
                            label="Search couriers..."
                            slotProps={{
                                input: {
                                    ...autoInputProps,
                                    endAdornment: (
                                        <>
                                            {couriersLoading ? <CircularProgress size={20} /> : null}
                                            {autoInputProps.endAdornment}
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
