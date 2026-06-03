/**
 * DateRangePicker Component
 *
 * React replacement for the AngularJS date range selection in jobSearch.
 * Renders preset range buttons (Today, Fortnight, Month, Custom) and
 * optional From/To date inputs when Custom is selected.
 *
 * Uses a plain TextField for typing dates (DD/MM/YYYY) with a MUI
 * DatePicker calendar popup for visual selection.  The MUI DatePicker's
 * built-in field uses section-based spinbutton editing which mangles
 * fast typing, so we bypass it entirely.
 */

import React, {useState, useEffect, useCallback} from 'react';
import {alpha} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import Popover from '@mui/material/Popover';
import dayjs, {Dayjs} from 'dayjs';

/** Parse a DD/MM/YYYY string into a dayjs object without relying on customParseFormat plugin. */
function parseDDMMYYYY(input: string): Dayjs | null {
    const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const d = dayjs(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    return d.isValid() ? d : null;
}

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

interface DateInputProps {
    value: Dayjs;
    onChange: (dateTime: Dayjs) => void;
}

const DateInput: React.FC<DateInputProps> = ({value, onChange}) => {
    const [text, setText] = useState(value?.isValid() ? value.format('DD/MM/YYYY') : '');
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (value?.isValid()) {
            setText(value.format('DD/MM/YYYY'));
        }
    }, [value]);

    const commitText = useCallback((input: string) => {
        const parsed = parseDDMMYYYY(input);
        if (parsed) {
            onChange(parsed);
        } else {
            // Revert to last valid value
            setText(value?.isValid() ? value.format('DD/MM/YYYY') : '');
        }
    }, [onChange, value]);

    const handleCalendarChange = useCallback((newValue: Dayjs | null) => {
        if (newValue?.isValid()) {
            onChange(newValue);
            setAnchorEl(null);
        }
    }, [onChange]);

    return (
        <>
            <TextField
                size="small"
                fullWidth
                placeholder="DD/MM/YYYY"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => commitText(text)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commitText(text);
                }}
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    edge="end"
                                    onClick={(e) => setAnchorEl(e.currentTarget)}
                                >
                                    <CalendarTodayIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
            />
            <Popover
                open={!!anchorEl}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
            >
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateCalendar value={value} onChange={handleCalendarChange} />
                </LocalizationProvider>
            </Popover>
        </>
    );
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
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                display: 'block',
                                mb: 0.5
                            }}>
                            From
                        </Typography>
                        <DateInput value={fromDate} onChange={onFromDateChange} />
                    </Box>
                    <Box sx={{flex: '1 1 120px', minWidth: 0}}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                display: 'block',
                                mb: 0.5
                            }}>
                            To
                        </Typography>
                        <DateInput value={toDate} onChange={onToDateChange} />
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default DateRangePicker;
