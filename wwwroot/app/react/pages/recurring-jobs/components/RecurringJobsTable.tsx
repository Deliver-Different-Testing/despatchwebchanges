/**
 * Recurring Jobs Table Component
 *
 * Data table with sorting, pagination, and row selection for recurring jobs.
 */

import React from 'react';
import {ActionIcon, Box, Text, Tooltip} from '@mantine/core';
import {Power, Repeat} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {DataTable, type DataTableColumn} from '../../../components/common/data-table';
import type {Dayjs} from 'dayjs';
import {AddressViewModel, PrebookListModel, RecurringJobColumn, RecurringJobSort,} from '../../../interfaces';

export interface RecurringJobsTableProps {
    jobs: PrebookListModel[];
    isLoading: boolean;
    totalCount: number;
    page: number;
    pageSize: number;
    sort: RecurringJobSort;
    selectedJobId: number | null;
    isUsCustomer: boolean;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    onSortChange: (sort: RecurringJobSort) => void;
    onRowClick: (job: PrebookListModel) => void;
    onDeleteClick: (job: PrebookListModel) => void;
    onContextMenu: (event: React.MouseEvent, job: PrebookListModel) => void;
}

const columns: RecurringJobColumn[] = [
    {key: 'booked', label: 'Booked', sortable: true, width: '110px'},
    {key: 'speed', label: 'Speed', sortable: true, width: '80px'},
    {key: 'customJobName', label: 'Job Name', sortable: true},
    {key: 'client', label: 'Client', sortable: true},
    {key: 'from', label: 'From', sortable: true},
    {key: 'to', label: 'To', sortable: true},
    {key: 'route', label: 'Route', sortable: false, width: '140px'},
    {key: 'nextDueTime', label: 'Next Due', sortable: true, sortKey: 'nextDueTime', width: '110px'},
    {key: 'courier', label: 'Courier', sortable: true, width: '100px'},
    {key: 'actions', label: '', sortable: false, width: '60px', align: 'center'},
];

const pageSizeOptions = [25, 50, 100, 250];

function formatDate(date: Dayjs | undefined): string {
    if (!date || !date.isValid()) return '-';
    return date.format('DD MMM YY');
}

function formatTime(date: Dayjs | undefined): string {
    if (!date || !date.isValid()) return '';
    return date.format('HH:mm');
}

function getAddressPrimary(address: AddressViewModel | undefined): string {
    if (!address) return '';
    return address.addressLine1 || address.fullAddress?.substring(0, 30) || '';
}

function getAddressSecondary(address: AddressViewModel | undefined, isUsCustomer: boolean): string {
    if (!address) return '';
    if (isUsCustomer) {
        const parts = [address.addressLine5, address.addressLine6].filter(Boolean);
        return parts.join(', ');
    }
    return address.addressLine2 || address.addressLine3 || '';
}

function getAddressTooltip(address: AddressViewModel | undefined): string {
    if (!address) return '';
    const lines = [
        address.addressLine1,
        address.addressLine2,
        address.addressLine3,
        address.addressLine4,
        address.addressLine5,
        address.addressLine6,
        address.addressLine7,
        address.addressLine8,
    ].filter(Boolean);

    if (lines.length === 0 && address.fullAddress) {
        return address.fullAddress;
    }
    return lines.join('\n');
}

export const RecurringJobsTable: React.FC<RecurringJobsTableProps> = ({
                                                                          jobs,
                                                                          isLoading,
                                                                          totalCount,
                                                                          page,
                                                                          pageSize,
                                                                          sort,
                                                                          selectedJobId,
                                                                          isUsCustomer,
                                                                          onPageChange,
                                                                          onPageSizeChange,
                                                                          onSortChange,
                                                                          onRowClick,
                                                                          onDeleteClick,
                                                                          onContextMenu,
                                                                      }) => {
    const renderCellContent = (job: PrebookListModel, column: RecurringJobColumn) => {
        switch (column.key) {
            case 'booked':
                return (
                    <Box>
                        <Text fz="sm" truncate>{formatDate(job.booked)}</Text>
                        <Text fz="xs" c="dimmed" truncate>{formatTime(job.booked)}</Text>
                    </Box>
                );
            case 'speed':
                return (
                    <Text fz="sm" truncate>{job.speed}</Text>
                );
            case 'customJobName':
                return (
                    <Tooltip label={job.customJobName || ''} position="top">
                        <Text fz="sm" truncate maw={150}>{job.customJobName || '-'}</Text>
                    </Tooltip>
                );
            case 'client':
                return (
                    <Text fz="sm" truncate>{job.client}</Text>
                );
            case 'from':
                return (
                    <Tooltip label={getAddressTooltip(job.pickupAddress)} position="top">
                        <Box>
                            <Text fz="sm" truncate maw={150}>{getAddressPrimary(job.pickupAddress)}</Text>
                            <Text fz="xs" c="dimmed" truncate maw={150}>
                                {getAddressSecondary(job.pickupAddress, isUsCustomer)}
                            </Text>
                        </Box>
                    </Tooltip>
                );
            case 'to':
                return (
                    <Tooltip label={getAddressTooltip(job.deliveryAddress)} position="top">
                        <Box>
                            <Text fz="sm" truncate maw={150}>{getAddressPrimary(job.deliveryAddress)}</Text>
                            <Text fz="xs" c="dimmed" truncate maw={150}>
                                {getAddressSecondary(job.deliveryAddress, isUsCustomer)}
                            </Text>
                        </Box>
                    </Tooltip>
                );
            case 'route':
                return (
                    <Tooltip label={job.routeName || ''} position="top">
                        <Text fz="sm" truncate maw={140}>{job.routeName || '-'}</Text>
                    </Tooltip>
                );
            case 'nextDueTime':
                return (
                    <Box>
                        <Text fz="sm" truncate>{formatDate(job.nextDueTime)}</Text>
                        <Text fz="xs" c="dimmed" truncate>{formatTime(job.nextDueTime)}</Text>
                    </Box>
                );
            case 'courier':
                return (
                    <Text fz="sm" truncate>{job.courier || '-'}</Text>
                );
            case 'actions':
                return (
                    <Tooltip label="Deactivate">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            aria-label="Deactivate"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(job);
                            }}
                        >
                            <Icon lucide={Power} size={16}/>
                        </ActionIcon>
                    </Tooltip>
                );
            default:
                return null;
        }
    };

    // The shared kit owns the markup; this file keeps only its column definitions
    // and cell renderers. Note TablePager is 1-based, so the page index no longer
    // needs the ±1 the MUI pagination required.
    const dataColumns: DataTableColumn<PrebookListModel>[] = columns.map((column) => ({
        key: column.key,
        label: column.label,
        sortable: column.sortable,
        sortKey: column.sortKey,
        width: column.width,
        align: column.align,
        render: (job) => renderCellContent(job, column),
    }));

    return (
        <DataTable
            rows={jobs}
            columns={dataColumns}
            rowKey={(job) => job.id}
            totalCount={totalCount}
            isLoading={isLoading}
            loadingMessage="Loading recurring jobs..."
            sort={sort}
            onSortChange={(next) => onSortChange(next as RecurringJobSort)}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            onRowClick={onRowClick}
            onRowContextMenu={onContextMenu}
            isRowSelected={(job) => selectedJobId === job.id}
            emptyIcon={<Icon lucide={Repeat} size={40}/>}
            emptyTitle="No Recurring Jobs"
            emptyMessage="No recurring jobs available"
        />
    );
};

export default RecurringJobsTable;
