/**
 * FamilyPriceChangeDialog
 *
 * Shows every price change resulting from a date cascade in one list, so the user accepts or
 * declines them together rather than being walked through a modal per job. Manually-priced
 * jobs are listed but never selectable — a hand-set price must not be clobbered.
 *
 * The single-job case still uses PriceChangeModal; this only appears for families.
 */
import React from 'react';
import type {SxProps, Theme} from '@mui/material';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import {DialogShell, DialogHeader, DialogFooter, sectionPaperSx, PriceDelta} from '../shared';

export interface FamilyPriceChangeRow {
    jobId: number;
    jobNo: string;
    oldPrice: number;
    newPrice: number;
    ratedManually: boolean;
}

export interface FamilyPriceChangeDialogProps {
    open: boolean;
    rows: FamilyPriceChangeRow[];
    selectedIds: ReadonlySet<number>;
    isApplying?: boolean;
    onToggle: (jobId: number) => void;
    onToggleAll: () => void;
    onAcceptSelected: () => void;
    onKeepAll: () => void;
}

const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    py: 0.5,
    '&:not(:last-of-type)': {borderBottom: '1px solid', borderColor: 'divider'},
} satisfies SxProps<Theme>;

const formatMoney = (value: number) => `$${value.toFixed(2)}`;

export const FamilyPriceChangeDialog: React.FC<FamilyPriceChangeDialogProps> = ({
    open,
    rows,
    selectedIds,
    isApplying = false,
    onToggle,
    onToggleAll,
    onAcceptSelected,
    onKeepAll,
}) => {
    const selectable = rows.filter((r) => !r.ratedManually);
    const selectedCount = selectable.filter((r) => selectedIds.has(r.jobId)).length;
    const allSelected = selectable.length > 0 && selectedCount === selectable.length;
    const netDelta = selectable
        .filter((r) => selectedIds.has(r.jobId))
        .reduce((sum, r) => sum + (r.newPrice - r.oldPrice), 0);

    return (
        <DialogShell open={open} onClose={isApplying ? undefined : onKeepAll}>
            <DialogHeader
                icon={<NotificationsActiveIcon/>}
                title="Prices changed"
                subtitle={`${rows.length} job${rows.length === 1 ? '' : 's'} affected`}
                onClose={onKeepAll}
                variant="warning"
                closeDisabled={isApplying}
            />
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        The new date changes what these jobs would be priced at. Choose which prices to update.
                    </Typography>

                    <Paper elevation={0} sx={sectionPaperSx}>
                        <Box sx={{...rowSx, borderBottom: '1px solid', borderColor: 'divider'}}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={allSelected}
                                        indeterminate={selectedCount > 0 && !allSelected}
                                        onChange={onToggleAll}
                                        disabled={isApplying || selectable.length === 0}
                                        slotProps={{input: {'aria-label': 'Select all price changes'}}}
                                    />
                                }
                                label={<Typography variant="body2" sx={{fontWeight: 600}}>Select all</Typography>}
                                sx={{flex: 1, m: 0}}
                            />
                        </Box>

                        {rows.map((row) => (
                            <Box key={row.jobId} sx={{...rowSx, opacity: row.ratedManually ? 0.6 : 1}}>
                                <Checkbox
                                    checked={selectedIds.has(row.jobId)}
                                    onChange={() => onToggle(row.jobId)}
                                    disabled={isApplying || row.ratedManually}
                                    slotProps={{input: {'aria-label': `Update price for ${row.jobNo}`}}}
                                />
                                <Typography variant="body2" sx={{flex: 1, fontWeight: 500}}>
                                    {row.jobNo}
                                </Typography>
                                {row.ratedManually && (
                                    <Chip size="small" variant="outlined" label="Manual price"/>
                                )}
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                    {formatMoney(row.oldPrice)} → {formatMoney(row.newPrice)}
                                </Typography>
                                <PriceDelta oldPrice={row.oldPrice} newPrice={row.newPrice}/>
                            </Box>
                        ))}
                    </Paper>

                    {selectedCount > 0 && (
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            Net change: <strong>{netDelta >= 0 ? '+' : ''}{netDelta.toFixed(2)}</strong>
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogFooter
                onCancel={onKeepAll}
                cancelLabel="Keep all"
                onConfirm={onAcceptSelected}
                confirmLabel={`Accept selected (${selectedCount})`}
                confirmIcon={<CheckIcon/>}
                confirmDisabled={selectedCount === 0}
                submitting={isApplying}
            />
        </DialogShell>
    );
};

export default FamilyPriceChangeDialog;
