/**
 * ItemLinesSection - a job's freight lines (pallets, cartons, banana boxes...) with a summary footer.
 * Each line leads with its own name; the section never assumes every line is a pallet (#955).
 */

import React from 'react';
import {Badge, Group, Paper, Table} from '@mantine/core';
import {List} from 'lucide-react';
import type {IPalletInfo} from '../JobDetails.types';
import {cardContainerProps} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';
import {pluralise} from '../../../../utils/pluralise';

interface ItemLinesSectionProps {
    lines: IPalletInfo[];
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
const flaggedRowStyle: React.CSSProperties = {opacity: 0.5};

// #860/#861: flagged lines stay on the job but don't count toward its totals.
const FLAG_LABELS: Record<number, string> = {1: 'Not picked up', 2: 'Not for delivery'};
const isActive = (line: IPalletInfo) => !line.itemStatus;

export const ItemLinesSection = React.memo(function ItemLinesSection({lines, isUsCustomer}: ItemLinesSectionProps) {
    if (!lines?.length) return null;

    const weightUnit = isUsCustomer ? 'lbs' : 'kg';
    const dimUnit = isUsCustomer ? 'in' : 'cm';
    // Cubic is stored as dimensional volume (ft³ for US, m³ for NZ) — see EditParcelDimensionsDialog's cubic
    // calc. Totalling the stored value keeps it right when a volume was set without dimensions.
    const volUnit = isUsCustomer ? 'ft³' : 'm³';

    const active = lines.filter(isActive);
    const flaggedCount = lines.length - active.length;
    const totalUnits = active.reduce((sum, line) => sum + (line.quantity || 0), 0);
    const totalWeight = active.reduce((sum, line) => sum + (line.weight || 0) * (line.quantity || 1), 0);
    const totalVolume = active.reduce((sum, line) => sum + (line.cubic || 0) * (line.quantity || 1), 0);
    const subtitle = [
        `${active.length} ${pluralise(active.length, 'line', 'lines')}`,
        `${totalUnits} ${pluralise(totalUnits, 'unit', 'units')}`,
        flaggedCount ? `${flaggedCount} flagged` : null,
    ].filter(Boolean).join(' · ');

    return (
        <Paper {...cardContainerProps}>
            <SectionHeader lucide={List} title="Items" subtitle={subtitle} />
            <Table highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th style={headerCellStyle}>Item</Table.Th>
                        <Table.Th style={headerCellStyle}>Item ID</Table.Th>
                        <Table.Th style={headerCellStyle} ta="right">Qty</Table.Th>
                        <Table.Th style={headerCellStyle} ta="right">Weight ({weightUnit})</Table.Th>
                        <Table.Th style={headerCellStyle}>Dimensions ({dimUnit})</Table.Th>
                        <Table.Th style={headerCellStyle} ta="right">Volume ({volUnit})</Table.Th>
                        <Table.Th style={headerCellStyle}>Status</Table.Th>
                        <Table.Th style={headerCellStyle}>DG class</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {lines.map((line, index) => (
                        <Table.Tr key={`${line.itemId}-${index}`} style={isActive(line) ? undefined : flaggedRowStyle}>
                            <Table.Td style={cellBoldStyle}>{line.notes?.trim() || '—'}</Table.Td>
                            <Table.Td style={cellStyle}>{line.itemId || '—'}</Table.Td>
                            <Table.Td style={cellStyle} ta="right">{line.quantity}</Table.Td>
                            <Table.Td style={cellStyle} ta="right">{line.weight}</Table.Td>
                            <Table.Td style={cellStyle}>
                                {line.length || line.depth || line.height
                                    ? `${line.length} x ${line.depth} x ${line.height}`
                                    : '—'}
                            </Table.Td>
                            <Table.Td style={cellStyle} ta="right">{line.cubic ? line.cubic.toFixed(3) : '—'}</Table.Td>
                            <Table.Td style={cellStyle}>
                                <Group gap={4}>
                                    {line.pu && <Badge size="sm" color="brand">PU</Badge>}
                                    {line.do && <Badge size="sm" color="green">DO</Badge>}
                                    {!isActive(line) && (
                                        <Badge size="sm" color="gray" variant="outline">
                                            {FLAG_LABELS[line.itemStatus!] ?? 'Flagged'}
                                        </Badge>
                                    )}
                                </Group>
                            </Table.Td>
                            <Table.Td style={cellStyle}>{line.dgClass || '—'}</Table.Td>
                        </Table.Tr>
                    ))}
                    <Table.Tr style={summaryRowStyle}>
                        <Table.Td style={cellBoldStyle}>Total</Table.Td>
                        <Table.Td style={cellBoldStyle} />
                        <Table.Td style={cellBoldStyle} ta="right">{totalUnits}</Table.Td>
                        <Table.Td style={cellBoldStyle} ta="right">{totalWeight.toFixed(1)}</Table.Td>
                        <Table.Td style={cellBoldStyle} colSpan={4}>
                            Volume: {totalVolume.toFixed(3)} {volUnit}
                        </Table.Td>
                    </Table.Tr>
                </Table.Tbody>
            </Table>
        </Paper>
    );
});
