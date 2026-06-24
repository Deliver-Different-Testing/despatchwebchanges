/**
 * PalletSection - Table displaying pallet/item information for a job.
 * Matches AngularJS pallet info section with summary footer.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Chip from '@mui/material/Chip';
import ViewListIcon from '@mui/icons-material/ViewList';
import type {IPalletInfo} from '../JobDetails.types';
import {cardContainerSx} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';

interface PalletSectionProps {
    pallets: IPalletInfo[];
    isUsCustomer: boolean;
}

const cellSx = {py: 0.75, px: 1.5, fontSize: '0.8125rem'} as const;
const cellBoldSx = {...cellSx, fontWeight: 600} as const;
const headerCellSx = {...cellSx, fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary'} as const;

export const PalletSection = React.memo(function PalletSection({pallets, isUsCustomer}: PalletSectionProps) {
    if (!pallets?.length) return null;

    const weightUnit = isUsCustomer ? 'lbs' : 'kg';
    const dimUnit = isUsCustomer ? 'in' : 'cm';
    const volUnit = isUsCustomer ? 'in\u00B3' : 'cm\u00B3';

    const totalItems = pallets.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalWeight = pallets.reduce((sum, p) => sum + (p.weight || 0) * (p.quantity || 1), 0);
    const totalVolume = pallets.reduce((sum, p) => {
        const vol = (p.length || 0) * (p.depth || 0) * (p.height || 0);
        return sum + vol * (p.quantity || 1);
    }, 0);

    return (
        <Box sx={cardContainerSx}>
            <SectionHeader
                icon={ViewListIcon}
                title="Pallet Information"
                subtitle={`${pallets.length} ${pallets.length === 1 ? 'pallet' : 'pallets'}`}
            />
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell sx={headerCellSx}>Item ID</TableCell>
                        <TableCell sx={headerCellSx} align="right">Qty</TableCell>
                        <TableCell sx={headerCellSx} align="right">Weight ({weightUnit})</TableCell>
                        <TableCell sx={headerCellSx}>Dimensions ({dimUnit})</TableCell>
                        <TableCell sx={headerCellSx}>Status</TableCell>
                        <TableCell sx={headerCellSx}>DG Class</TableCell>
                        <TableCell sx={headerCellSx}>Notes</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {pallets.map((pallet, index) => (
                        <TableRow
                            key={`${pallet.itemId}-${index}`}
                            hover
                        >
                            <TableCell sx={cellSx}>{pallet.itemId || '\u2014'}</TableCell>
                            <TableCell sx={cellSx} align="right">{pallet.quantity}</TableCell>
                            <TableCell sx={cellSx} align="right">{pallet.weight}</TableCell>
                            <TableCell sx={cellSx}>
                                {pallet.length} x {pallet.depth} x {pallet.height}
                            </TableCell>
                            <TableCell sx={cellSx}>
                                <Box sx={{display: 'flex', gap: 0.5}}>
                                    {pallet.pu && <Chip label="PU" size="small" color="primary" sx={{height: 20, fontSize: '0.6875rem'}} />}
                                    {pallet.do && <Chip label="DO" size="small" color="success" sx={{height: 20, fontSize: '0.6875rem'}} />}
                                </Box>
                            </TableCell>
                            <TableCell sx={cellSx}>{pallet.dgClass || '\u2014'}</TableCell>
                            <TableCell sx={cellSx}>{pallet.notes || '\u2014'}</TableCell>
                        </TableRow>
                    ))}
                    {/* Summary footer */}
                    <TableRow sx={{bgcolor: 'grey.50'}}>
                        <TableCell sx={cellBoldSx}>Total</TableCell>
                        <TableCell sx={cellBoldSx} align="right">{totalItems}</TableCell>
                        <TableCell sx={cellBoldSx} align="right">{totalWeight.toFixed(1)}</TableCell>
                        <TableCell sx={cellBoldSx} colSpan={4}>
                            Volume: {totalVolume.toFixed(1)} {volUnit}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </Box>
    );
});
