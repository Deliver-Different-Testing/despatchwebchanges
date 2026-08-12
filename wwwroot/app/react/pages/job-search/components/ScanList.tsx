import React from 'react';
import {Group, Loader, Table} from '@mantine/core';
import {IconQrcode} from '@tabler/icons-react';
import {NoData} from '../../../components/common/no-data/NoData';
import {Icon} from '../../../components/common/icon/Icon';
import {formatLongDateTime} from '../../../utils/dateUtils';
import {useScanDetail} from '../hooks/useScanDetail';

export interface ScanListProps {
    jobId?: number;
    runDate?: unknown;
    isBulkJob?: boolean;
    timeZoneShort?: string;
}

const scanIcon = <Icon tabler={IconQrcode}/>;

export const ScanList: React.FC<ScanListProps> = ({jobId, runDate, isBulkJob = false, timeZoneShort}) => {
    const {scans, isLoading} = useScanDetail({jobId, runDate, isBulkJob});

    if (!jobId) {
        return (
            <NoData
                title="No Job Selected"
                message="Select a job to see its scan records."
                icon={scanIcon}
            />
        );
    }

    if (isLoading) {
        return (
            <Group justify="center" p="md">
                <Loader size="sm" aria-label="Loading scan records"/>
            </Group>
        );
    }

    if (scans.length === 0) {
        return (
            <NoData
                title="No Scan Records"
                message="This job has no scan records. Use the driver application to scan the job items."
                icon={scanIcon}
            />
        );
    }

    return (
        // `stickyHeader` and `highlightOnHover` are native props; the scroll box is the
        // panel body, so the table only needs to fill it.
        <Table.ScrollContainer minWidth={480} h="100%">
            <Table stickyHeader highlightOnHover verticalSpacing="xs" fz="sm">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Date/Time</Table.Th>
                        <Table.Th>Scan Detail</Table.Th>
                        <Table.Th>Courier</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {scans.map(scan => (
                        <Table.Tr key={scan.bulkScanId}>
                            <Table.Td>
                                {formatLongDateTime(scan.scanDateTime)}
                                {timeZoneShort ? ` (${timeZoneShort})` : null}
                            </Table.Td>
                            <Table.Td>{scan.scanDetail}</Table.Td>
                            <Table.Td>{scan.courier}</Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </Table.ScrollContainer>
    );
};
