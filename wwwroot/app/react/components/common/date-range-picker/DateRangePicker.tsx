/**
 * DateRangePicker Component
 *
 * React replacement for the AngularJS date range selection in jobSearch.
 * Renders preset range buttons (Today, Fortnight, Month, Custom) and
 * optional From/To date pickers when Custom is selected.
 */

import React from 'react';
import {Box, ToggleButton, ToggleButtonGroup, Typography} from '@mui/material';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {Dayjs} from 'dayjs';

export interface DateRangePickerProps {
    dateSearchRange: string;
    fromDate: Dayjs;
    toDate: Dayjs;
    onSearchRangeChange: (range: string) => void;
    onFromDateChange: (dateTime: Dayjs) => void;
    onToDateChange: (dateTime: Dayjs) => void;
}

const RANGE_OPTIONS = [
    {value: 'today', label: 'Today'},
    {value: 'fortnight', label: 'Fortnight'},
    {value: 'month', label: 'Month'},
    {value: 'custom', label: 'Custom'},
] as const;

const toggleButtonSx = {
    flex: '1 1 auto',
    minWidth: 70,
    height: 32,
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: '4px !important',
    border: 'none !important',
    bgcolor: 'rgba(0, 0, 0, 0.04)',
    color: 'text.primary',
    '&:hover': {
        bgcolor: 'rgba(0, 0, 0, 0.08)',
    },
    '&.Mui-selected': {
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        boxShadow: 'none',
        '&:hover': {
            bgcolor: 'primary.dark',
        },
    },
} as const;

const datePickerSlotProps = {
    textField: {
        size: 'small' as const,
        fullWidth: true,
    },
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    dateSearchRange,
    fromDate,
    toDate,
    onSearchRangeChange,
    onFromDateChange,
    onToDateChange,
}) => {
    const handleRangeChange = (_event: React.MouseEvent<HTMLElement>, newRange: string | null) => {
        if (newRange !== null) {
            onSearchRangeChange(newRange);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box>
                <ToggleButtonGroup
                    value={dateSearchRange}
                    exclusive
                    onChange={handleRangeChange}
                    sx={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}
                >
                    {RANGE_OPTIONS.map(({value, label}) => (
                        <ToggleButton key={value} value={value} sx={toggleButtonSx}>
                            {label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                {dateSearchRange === 'custom' && (
                    <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        mt: 1,
                        pt: 1.5,
                        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                    }}>
                        <Box sx={{flex: '1 1 120px', minWidth: 0}}>
                            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5}}>
                                From
                            </Typography>
                            <DatePicker
                                value={fromDate}
                                onChange={(newValue) => newValue && onFromDateChange(newValue)}
                                format="DD/MM/YYYY"
                                enableAccessibleFieldDOMStructure={false}
                                slotProps={datePickerSlotProps}
                            />
                        </Box>
                        <Box sx={{flex: '1 1 120px', minWidth: 0}}>
                            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5}}>
                                To
                            </Typography>
                            <DatePicker
                                value={toDate}
                                onChange={(newValue) => newValue && onToDateChange(newValue)}
                                format="DD/MM/YYYY"
                                enableAccessibleFieldDOMStructure={false}
                                slotProps={datePickerSlotProps}
                            />
                        </Box>
                    </Box>
                )}
            </Box>
        </LocalizationProvider>
    );
};

export default DateRangePicker;
