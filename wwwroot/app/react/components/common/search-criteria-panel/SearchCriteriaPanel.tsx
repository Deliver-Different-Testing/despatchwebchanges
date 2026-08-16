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
import type {SxProps, Theme} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadIcon from '@mui/icons-material/Upload';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

const groupLabelSx: SxProps<Theme> = {
    fontSize: '0.625rem',
    fontWeight: 500,
    color: 'text.secondary',
    textTransform: 'uppercase',
    letterSpacing: '0.08333em',
    lineHeight: 2.5,
};

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
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: 2,
            height: '100%',
            boxSizing: 'border-box',
            overflowY: 'auto',
        }}>
            {/* Date Range */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0}}>
                <Typography sx={groupLabelSx}>Date Range</Typography>
                <DateRangePicker
                    dateSearchRange={dateSearchRange}
                    fromDate={localFromDate}
                    toDate={localToDate}
                    onSearchRangeChange={onSearchRangeChange}
                    onFromDateChange={setLocalFromDate}
                    onToDateChange={setLocalToDate}
                />
            </Box>

            {/* Clients */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0}}>
                <Typography sx={groupLabelSx}>Clients</Typography>
                <ChipsAutocomplete
                    label="Clients"
                    placeholder="Search clients..."
                    value={clients}
                    minInputLength={2}
                    onSearch={onClientSearch}
                    onChange={handleClientsChange}
                />
            </Box>

            {/* Couriers */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0}}>
                <Typography sx={groupLabelSx}>Couriers</Typography>
                <ChipsAutocomplete
                    label="Couriers"
                    placeholder="Search couriers..."
                    value={couriers}
                    minInputLength={1}
                    onSearch={onCourierSearch}
                    onChange={handleCouriersChange}
                />
            </Box>

            {/* Speeds */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0}}>
                <Typography sx={groupLabelSx}>Speeds</Typography>
                <ChipsAutocomplete
                    label="Speeds"
                    placeholder="Search speeds..."
                    value={speeds}
                    minInputLength={1}
                    onSearch={onSpeedSearch}
                    onChange={handleSpeedsChange}
                />
            </Box>

            {/* Job Number */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0}}>
                <Typography sx={groupLabelSx}>Job Number</Typography>
                <TextField
                    size="small"
                    placeholder="Enter job number"
                    value={jobNumber}
                    onChange={handleJobNumberChange}
                    onKeyUp={handleKeyUp}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            height: 34,
                            fontSize: '0.8125rem',
                            bgcolor: 'background.paper',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'divider',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'text.disabled',
                            },
                        },
                    }}
                />
            </Box>

            {/* General Search */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0}}>
                <Typography sx={groupLabelSx}>General Search</Typography>
                <TextField
                    size="small"
                    placeholder="Address, name, reference..."
                    value={generalSearch}
                    onChange={handleGeneralSearchChange}
                    onKeyUp={handleKeyUp}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            height: 34,
                            fontSize: '0.8125rem',
                            bgcolor: 'background.paper',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'divider',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'text.disabled',
                            },
                        },
                    }}
                />
            </Box>

            {/* Advanced Options */}
            <Box>
                <Button
                    size="small"
                    onClick={() => setAdvancedOpen(prev => !prev)}
                    endIcon={
                        <ExpandMoreIcon
                            sx={{
                                transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                            }}
                        />
                    }
                    sx={{
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        p: 0,
                        minWidth: 0,
                        '&:hover': {bgcolor: 'transparent'},
                    }}
                >
                    Advanced
                </Button>
                <Collapse in={advancedOpen}>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1}}>
                        <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75}}>
                            <Typography sx={groupLabelSx}>Job ID</Typography>
                            <TextField
                                type="number"
                                size="small"
                                placeholder="Enter job ID"
                                value={jobId}
                                disabled={!!bulkJobId}
                                onChange={handleJobIdChange}
                                onKeyUp={handleKeyUp}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        height: 34,
                                        fontSize: '0.8125rem',
                                        bgcolor: 'background.paper',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'divider',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'text.disabled',
                                        },
                                    },
                                }}
                            />
                        </Box>
                        <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75}}>
                            <Typography sx={groupLabelSx}>Bulk Job ID</Typography>
                            <TextField
                                type="number"
                                size="small"
                                placeholder="Enter bulk job ID"
                                value={bulkJobId}
                                disabled={!!jobId}
                                onChange={handleBulkJobIdChange}
                                onKeyUp={handleKeyUp}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        height: 34,
                                        fontSize: '0.8125rem',
                                        bgcolor: 'background.paper',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'divider',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'text.disabled',
                                        },
                                    },
                                }}
                            />
                        </Box>
                    </Box>
                </Collapse>
            </Box>

            {/* Actions */}
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1,
                mt: 'auto',
                pt: 2,
                borderTop: 1,
                borderColor: 'divider',
            }}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={flushAndSearch}
                    sx={{
                        flex: '1 1 auto',
                        minWidth: 100,
                        height: 36,
                        textTransform: 'none',
                    }}
                >
                    Search
                </Button>
                <Box sx={{display: 'flex', gap: 0.5}}>
                    <Tooltip title="Download">
                        <IconButton onClick={flushAndDownload} size="small" sx={{width: 36, height: 36}}>
                            <DownloadIcon sx={{fontSize: 20, color: 'text.secondary'}} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Client Report">
                        <span>
                            <IconButton
                                onClick={flushAndClientReport}
                                disabled={!isClientReportEnabled}
                                size="small"
                                sx={{width: 36, height: 36}}
                            >
                                <DescriptionIcon sx={{fontSize: 20, color: isClientReportEnabled ? 'text.secondary' : 'text.disabled'}} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Price Detail Report">
                        <IconButton onClick={flushAndPriceDetailReport} size="small" sx={{width: 36, height: 36}}>
                            <ReceiptLongIcon sx={{fontSize: 20, color: 'text.secondary'}} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Upload Prices">
                        <IconButton onClick={onUpload} size="small" sx={{width: 36, height: 36}}>
                            <UploadIcon sx={{fontSize: 20, color: 'text.secondary'}} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
        </Box>
    );
};

export default SearchCriteriaPanel;
