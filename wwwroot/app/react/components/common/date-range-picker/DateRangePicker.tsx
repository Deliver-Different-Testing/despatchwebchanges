/**
 * DateRangePicker Component
 *
 * React replacement for the AngularJS date range selection in jobSearch.
 * Renders preset range buttons (Today, Fortnight, Month, Custom) and
 * optional From/To date pickers when Custom is selected.
 */

import React from 'react';
import {alpha} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
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

const toggleButtonSx: SxProps<Theme> = {
    flex: '1 1 auto',
    minWidth: 70,
    height: 32,
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'none',
};

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
                    sx={(theme) => ({
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        '& .MuiToggleButtonGroup-grouped': {
                            border: 'none',
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.text.primary, 0.04),
                            color: 'text.primary',
                            '&:hover': {
                                bgcolor: alpha(theme.palette.text.primary, 0.08),
                            },
                            '&.Mui-selected': {
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: 'primary.dark',
                                },
                            },
                        },
                    })}
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
                        borderTop: 1,
                        borderColor: 'divider',
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
