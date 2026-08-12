/**
 * PalletSection - Table displaying pallet/item information for a job.
 * Matches AngularJS pallet info section with summary footer.
 */

import React from 'react';
import {Badge, Group, Paper, Table} from '@mantine/core';
import {List} from 'lucide-react';
import type {IPalletInfo} from '../JobDetails.types';
import {cardContainerProps} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';

interface PalletSectionProps {
    pallets: IPalletInfo[];
    isUsCustomer: boolean;
}

const cellStyle: React.CSSProperties = {paddingBlock: 6, paddingInline: 12, fontSize: '0.8125rem'};
const cellBoldStyle: React.CSSProperties = {...cellStyle, fontWeight: 600};
const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 600,
    fontSize: '0.75rem',
    color: 'var(--mantine-color-dimmed)',
};
const summaryRowStyle: React.CSSProperties = {backgroundColor: 'var(--mantine-color-gray-1)'};

export const PalletSection = React.memo(function PalletSection({pallets, isUsCustomer}: PalletSectionProps) {
    if (!pallets?.length) return null;

    const weightUnit = isUsCustomer ? 'lbs' : 'kg';
    const dimUnit = isUsCustomer ? 'in' : 'cm';
    // Cubic is stored as dimensional volume (ft³ for US, m³ for NZ) — see
    // EditParcelDimensionsDialog's cubic calc. Sourcing the total from this stored value
    // (rather than recomputing from L×W×H) keeps it accurate even when a job's volume was
    // set without dimensions (e.g. a Per Job weight/volume entry with no L/W/H).
    const volUnit = isUsCustomer ? 'ft³' : 'm³';

    const totalItems = pallets.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalWeight = pallets.reduce((sum, p) => sum + (p.weight || 0) * (p.quantity || 1), 0);
    const totalVolume = pallets.reduce((sum, p) => sum + (p.cubic || 0) * (p.quantity || 1), 0);

    return (
        <Paper {...cardContainerProps}>
            <SectionHeader
                lucide={List}
                title="Pallet Information"
                subtitle={`${pallets.length} ${pallets.length === 1 ? 'pallet' : 'pallets'}`}
            />
            <Table highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th style={headerCellStyle}>Item ID</Table.Th>
                        <Table.Th style={headerCellStyle} ta="right">Qty</Table.Th>
                        <Table.Th style={headerCellStyle} ta="right">Weight ({weightUnit})</Table.Th>
                        <Table.Th style={headerCellStyle}>Dimensions ({dimUnit})</Table.Th>
                        <Table.Th style={headerCellStyle} ta="right">Volume ({volUnit})</Table.Th>
                        <Table.Th style={headerCellStyle}>Status</Table.Th>
                        <Table.Th style={headerCellStyle}>DG Class</Table.Th>
                        <Table.Th style={headerCellStyle}>Notes</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {pallets.map((pallet, index) => (
                        <Table.Tr key={`${pallet.itemId}-${index}`}>
                            <Table.Td style={cellStyle}>{pallet.itemId || '—'}</Table.Td>
                            <Table.Td style={cellStyle} ta="right">{pallet.quantity}</Table.Td>
                            <Table.Td style={cellStyle} ta="right">{pallet.weight}</Table.Td>
                            <Table.Td style={cellStyle}>
                                {pallet.length || pallet.depth || pallet.height
                                    ? `${pallet.length} x ${pallet.depth} x ${pallet.height}`
                                    : '—'}
                            </Table.Td>
                            <Table.Td style={cellStyle} ta="right">{pallet.cubic ? pallet.cubic.toFixed(3) : '—'}</Table.Td>
                            <Table.Td style={cellStyle}>
                                <Group gap={4}>
                                    {pallet.pu && <Badge size="sm" color="brand">PU</Badge>}
                                    {pallet.do && <Badge size="sm" color="green">DO</Badge>}
                                </Group>
                            </Table.Td>
                            <Table.Td style={cellStyle}>{pallet.dgClass || '—'}</Table.Td>
                            <Table.Td style={cellStyle}>{pallet.notes || '—'}</Table.Td>
                        </Table.Tr>
                    ))}
                    {/* Summary footer */}
                    <Table.Tr style={summaryRowStyle}>
                        <Table.Td style={cellBoldStyle}>Total</Table.Td>
                        <Table.Td style={cellBoldStyle} ta="right">{totalItems}</Table.Td>
                        <Table.Td style={cellBoldStyle} ta="right">{totalWeight.toFixed(1)}</Table.Td>
                        <Table.Td style={cellBoldStyle} colSpan={5}>
                            Volume: {totalVolume.toFixed(3)} {volUnit}
                        </Table.Td>
                    </Table.Tr>
                </Table.Tbody>
            </Table>
        </Paper>
    );
});
