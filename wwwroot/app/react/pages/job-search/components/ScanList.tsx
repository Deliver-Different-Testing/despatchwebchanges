import React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import dayjs from 'dayjs';
import {NoData} from '../../../components/common/no-data/NoData';
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
        return (
            <NoData
                title="No Job Selected"
                message="Select a job to see its scan records."
                icon={<QrCodeScannerIcon/>}
            />
        );
    }

    if (isLoading) {
        return (
            <Box sx={{p: 2}}>
                <LinearProgress />
            </Box>
        );
    }

    if (scans.length === 0) {
        return (
            <NoData
                title="No Scan Records"
                message="This job has no scan records. Use the driver application to scan the job items."
                icon={<QrCodeScannerIcon/>}
            />
        );
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
