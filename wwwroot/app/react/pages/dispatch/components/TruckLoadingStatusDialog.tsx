import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Box, Paper, SimpleGrid, Text} from '@mantine/core';
import {RefreshCw} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';
import {Icon} from '../../../components/common/icon/Icon';
import {fetchTruckCourierStatus} from '../../../services/courierApi';
import {queryKeys} from '../../../query/queryClient';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    sectionPaperProps,
} from '../../../components/dialogs/shared/mantine';

export interface TruckLoadingStatusDialogProps {
    open: boolean;
    courierId?: number;
    courierLabel?: string;
    isUsCustomer: boolean;
    onClose: () => void;
}

const numberOrDash = (v: number | undefined): string =>
    v === undefined || v === null ? '—' : String(v);

/**
 * Read-only truck loading status (pallet + weight capacity) for a courier,
 * with a Refresh button. React port of the AngularJS
 * truck-courier-status-dialog. Follows the shared dialog design language.
 */
export const TruckLoadingStatusDialog: React.FC<TruckLoadingStatusDialogProps> = ({
    open,
    courierId,
    courierLabel,
    isUsCustomer,
    onClose,
}) => {
    const weightUnit = isUsCustomer ? 'lbs' : 'kg';

    const {data, isFetching, refetch} = useQuery({
        queryKey: queryKeys.dispatch.truckCourierStatus(courierId ?? 0),
        queryFn: ({signal}) => fetchTruckCourierStatus(courierId!, {signal}),
        enabled: open && !!courierId,
    });

    const availableWeight = data?.maxPayLoad != null && data?.currentWeight != null
        ? data.maxPayLoad - data.currentWeight
        : undefined;

    const fields: Array<{label: string; value: string}> = [
        {label: 'Max Pallets', value: numberOrDash(data?.maxPallets)},
        {label: `Max Weight (${weightUnit})`, value: numberOrDash(data?.maxPayLoad)},
        {label: 'Available Pallets', value: numberOrDash(data?.availablePallets)},
        {label: 'Current Pallets', value: numberOrDash(data?.currentPallets)},
        {label: `Current Weight (${weightUnit})`, value: numberOrDash(data?.currentWeight)},
        {label: `Available Weight (${weightUnit})`, value: numberOrDash(availableWeight)},
    ];

    return (
        <DialogShell opened={open} onClose={onClose} label="Truck Loading Status">
            <DialogHeader
                icon={<Icon tabler={IconTruck}/>}
                title="Truck Loading Status"
                subtitle={courierLabel}
                onClose={onClose}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Paper {...sectionPaperProps}>
                    <SimpleGrid cols={3} spacing="md">
                        {fields.map(f => (
                            <Box key={f.label}>
                                <Text size="sm" c="dimmed" mb={4}>{f.label}</Text>
                                <Text size="lg" fw={600}>{f.value}</Text>
                            </Box>
                        ))}
                    </SimpleGrid>
                </Paper>
            </Box>
            <DialogFooter
                onCancel={onClose}
                cancelLabel="Close"
                onConfirm={() => refetch()}
                confirmLabel="Refresh"
                confirmIcon={<Icon lucide={RefreshCw} size={16}/>}
                submitting={isFetching}
            />
        </DialogShell>
    );
};
