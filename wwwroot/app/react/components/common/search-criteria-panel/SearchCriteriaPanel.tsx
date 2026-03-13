/**
 * SearchCriteriaPanel Component
 *
 * React replacement for the entire pickDate.html AngularJS template.
 * Composes DateRangePicker, ChipsAutocomplete inputs, text search fields,
 * and action buttons into a single panel.
 */

import React, {useState, useCallback} from 'react';
import {Box, Typography, TextField, Button, IconButton, Tooltip} from '@mui/material';
import {
    Download as DownloadIcon,
    Description as DescriptionIcon,
    Upload as UploadIcon,
} from '@mui/icons-material';
import {Dayjs} from 'dayjs';
import {DateRangePicker} from '../date-range-picker/DateRangePicker';
import {ChipsAutocomplete} from './ChipsAutocomplete';
import {ISuggestion} from '../../../../interfaces/job.interface';

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
    onSearch: () => void;
    onDownload: () => void;
    onClientReport: () => void;
    onUpload: (event: React.MouseEvent) => void;
    onClientSearch: (searchText: string) => Promise<ISuggestion[]>;
    onCourierSearch: (searchText: string) => Promise<ISuggestion[]>;
    onSpeedSearch: (searchText: string) => Promise<ISuggestion[]>;
}

const groupLabelSx = {
    fontSize: '0.675rem',
    fontWeight: 600,
    color: 'text.secondary',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
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
    onUpload,
    onClientSearch,
    onCourierSearch,
    onSpeedSearch,
}) => {
    // Local state for chips and text inputs
    const [clients, setClients] = useState<ISuggestion[]>([]);
    const [couriers, setCouriers] = useState<ISuggestion[]>([]);
    const [speeds, setSpeeds] = useState<ISuggestion[]>([]);
    const [jobId, setJobId] = useState('');
    const [jobNumber, setJobNumber] = useState('');
    const [generalSearch, setGeneralSearch] = useState('');

    const isClientReportEnabled = clients.length > 0 && !!fromDate && !!toDate;

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
            onSearch();
        }
    }, [onSearch]);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '16px',
            height: '100%',
            boxSizing: 'border-box',
            overflowY: 'auto',
        }}>
            {/* Date Range */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
                <Typography sx={groupLabelSx}>Date Range</Typography>
                <DateRangePicker
                    dateSearchRange={dateSearchRange}
                    fromDate={fromDate}
                    toDate={toDate}
                    onSearchRangeChange={onSearchRangeChange}
                    onFromDateChange={onFromDateChange}
                    onToDateChange={onToDateChange}
                />
            </Box>

            {/* Clients */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
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
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
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
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
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

            {/* Job ID */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
                <Typography sx={groupLabelSx}>Job ID</Typography>
                <TextField
                    type="number"
                    size="small"
                    placeholder="Enter job ID"
                    value={jobId}
                    onChange={handleJobIdChange}
                    onKeyUp={handleKeyUp}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            height: 34,
                            fontSize: '0.8125rem',
                            bgcolor: 'background.paper',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.12)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.3)',
                            },
                        },
                    }}
                />
            </Box>

            {/* Job Number */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
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
                                borderColor: 'rgba(0, 0, 0, 0.12)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.3)',
                            },
                        },
                    }}
                />
            </Box>

            {/* General Search */}
            <Box sx={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
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
                                borderColor: 'rgba(0, 0, 0, 0.12)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(0, 0, 0, 0.3)',
                            },
                        },
                    }}
                />
            </Box>

            {/* Actions */}
            <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                marginTop: 'auto',
                paddingTop: '16px',
                borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            }}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={onSearch}
                    sx={{
                        flex: '1 1 auto',
                        minWidth: 100,
                        height: 36,
                        textTransform: 'none',
                    }}
                >
                    Search
                </Button>
                <Box sx={{display: 'flex', gap: '4px'}}>
                    <Tooltip title="Download">
                        <IconButton onClick={onDownload} size="small" sx={{width: 36, height: 36}}>
                            <DownloadIcon sx={{fontSize: 20, color: 'text.secondary'}} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Client Report">
                        <span>
                            <IconButton
                                onClick={onClientReport}
                                disabled={!isClientReportEnabled}
                                size="small"
                                sx={{width: 36, height: 36}}
                            >
                                <DescriptionIcon sx={{fontSize: 20, color: isClientReportEnabled ? 'text.secondary' : 'rgba(0, 0, 0, 0.2)'}} />
                            </IconButton>
                        </span>
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
