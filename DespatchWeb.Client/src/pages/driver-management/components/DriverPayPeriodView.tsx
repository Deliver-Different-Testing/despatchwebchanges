import {Button, Table, Text} from '@mantine/core';
import React, {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchEarlyFinishOptions} from '../../../api/courierApi';
import {EarlyFinishDialog} from '../../courier-map/components/EarlyFinishDialog';
import {useDriverPayPeriodOverview} from '../../../hooks/useDriverManagementApi';
import {formatCurrency} from '../../../utils/currencyUtils';
import {formatHoursDecimal} from './payPeriodFormat';

/**
 * The dispatcher's pay-period overview: who is behind on the minimum hourly guarantee, and by how much.
 * Deliberately shows no hourly rate, minimum hours or owed amount (and no hours unless the tenant turns them on).
 */
export const DriverPayPeriodView: React.FC = () => {
    const {data, isLoading, isError} = useDriverPayPeriodOverview();

    // Early finish can be recorded here for any driver on the guarantee, logged in or not (the courier map only lists
    // drivers with a live GPS position). Offered only to users holding dw-driver-early-finish.
    const {data: earlyFinish} = useQuery({
        queryKey: ['courier', 'earlyFinishOptions'],
        queryFn: ({signal}) => fetchEarlyFinishOptions({signal}),
        staleTime: 5 * 60_000,
    });
    const [earlyFinishDriver, setEarlyFinishDriver] = useState<{id: number; name: string} | null>(null);

    if (isLoading) {
        return <Text c="dimmed">Loading…</Text>;
    }
    if (isError) {
        return <Text c="red">Couldn&apos;t load the pay period. Try again.</Text>;
    }
    if (!data || data.items.length === 0) {
        return <Text c="dimmed">No drivers are on a minimum hourly guarantee this pay period.</Text>;
    }

    return (
        <>
        <Table highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Driver</Table.Th>
                    <Table.Th style={{textAlign: 'right'}}>Days worked</Table.Th>
                    <Table.Th style={{textAlign: 'right'}}>Deliveries</Table.Th>
                    {data.showHours && <Table.Th style={{textAlign: 'right'}}>Hours</Table.Th>}
                    <Table.Th style={{textAlign: 'right'}}>Behind by</Table.Th>
                    {earlyFinish?.available && <Table.Th />}
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {data.items.map(row => (
                    <Table.Tr key={row.courierId}>
                        <Table.Td>{row.code} {row.name}</Table.Td>
                        <Table.Td style={{textAlign: 'right'}}>{row.daysWorked}</Table.Td>
                        <Table.Td style={{textAlign: 'right'}}>{row.deliveries}</Table.Td>
                        {data.showHours && <Table.Td style={{textAlign: 'right'}}>{formatHoursDecimal(row.hours)}</Table.Td>}
                        <Table.Td style={{textAlign: 'right'}}>
                            {row.behindBy != null
                                ? <Text component="span" c="red" fw={600}>{formatCurrency(row.behindBy)}</Text>
                                : <Text component="span" c="dimmed">On target</Text>}
                        </Table.Td>
                        {earlyFinish?.available && (
                            <Table.Td style={{textAlign: 'right'}}>
                                <Button
                                    size="compact-xs"
                                    variant="subtle"
                                    onClick={() => setEarlyFinishDriver({id: row.courierId, name: `${row.code} ${row.name}`})}
                                >
                                    Record early finish…
                                </Button>
                            </Table.Td>
                        )}
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
        {earlyFinish?.available && earlyFinishDriver && (
            <EarlyFinishDialog
                key={earlyFinishDriver.id}
                opened
                onClose={() => setEarlyFinishDriver(null)}
                courierId={earlyFinishDriver.id}
                driverName={earlyFinishDriver.name}
                reasons={earlyFinish.reasons}
            />
        )}
        </>
    );
};
