import React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import dayjs from 'dayjs';
import {useScanDetail} from '../hooks/useScanDetail';

export interface ScanListProps {
    jobId?: number;
    runDate?: unknown;
    isBulkJob?: boolean;
    timeZoneShort?: string;
}

export const ScanList: React.FC<ScanListProps> = ({jobId, runDate, isBulkJob = false, timeZoneShort}) => {
    const {scans, isLoading} = useScanDetail({jobId, runDate, isBulkJob});

    if (!jobId) {
        return <EmptyState message="Select a job to see its scan records." />;
    }

    if (isLoading) {
        return (
            <Box sx={{p: 2}}>
                <LinearProgress />
            </Box>
        );
    }

    if (scans.length === 0) {
        return <EmptyState message="This job has no scan records. Use the driver application to scan the job items." />;
    }

    return (
        <TableContainer sx={{height: '100%', overflow: 'auto'}}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell>Date/Time</TableCell>
                        <TableCell>Scan Detail</TableCell>
                        <TableCell>Courier</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {scans.map(scan => (
                        <TableRow key={scan.bulkScanId} hover>
                            <TableCell>
                                {dayjs(scan.scanDateTime).format('DD/MM/YYYY h:mm a')}
                                {timeZoneShort ? ` (${timeZoneShort})` : null}
                            </TableCell>
                            <TableCell>{scan.scanDetail}</TableCell>
                            <TableCell>{scan.courier}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

const EmptyState: React.FC<{message: string}> = ({message}) => (
    <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 3,
            color: 'text.secondary',
            textAlign: 'center',
        }}
    >
        <QrCodeScannerIcon sx={{fontSize: 40, opacity: 0.5}} />
        <Typography variant="body2">{message}</Typography>
    </Box>
);
