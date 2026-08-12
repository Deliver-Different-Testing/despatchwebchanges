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
import {Badge, Divider, Box, Checkbox, Group, Paper, Stack, Text} from '@mantine/core';
import {BellRing, Check} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogShell, DialogHeader, DialogFooter, PriceDelta, dialogContentBg, sectionPaperProps,
} from '../shared/mantine';

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
        <DialogShell
            opened={open}
            onClose={isApplying ? () => {} : onKeepAll}
            label="Prices changed"
        >
            <DialogHeader
                icon={<Icon lucide={BellRing}/>}
                title="Prices changed"
                subtitle={`${rows.length} job${rows.length === 1 ? '' : 's'} affected`}
                onClose={onKeepAll}
                variant="warning"
                closeDisabled={isApplying}
            />
            <Box p="lg" bg={dialogContentBg}>
                <Stack gap="lg">
                    <Text size="sm" c="dimmed">
                        The new date changes what these jobs would be priced at. Choose which prices to update.
                    </Text>

                    {/* Rows are separated by real `Divider`s rather than a
                        `:not(:last-of-type)` rule, so no stylesheet is needed. */}
                    <Paper {...sectionPaperProps}>
                        <Group gap="xs" py={4}>
                            <Checkbox
                                checked={allSelected}
                                indeterminate={selectedCount > 0 && !allSelected}
                                onChange={onToggleAll}
                                disabled={isApplying || selectable.length === 0}
                                aria-label="Select all price changes"
                                label={<Text size="sm" fw={600}>Select all</Text>}
                            />
                        </Group>

                        {rows.map((row) => (
                            <React.Fragment key={row.jobId}>
                                <Divider/>
                                <Group
                                    gap="xs"
                                    py={4}
                                    wrap="nowrap"
                                    style={{opacity: row.ratedManually ? 0.6 : 1}}
                                >
                                    <Checkbox
                                        checked={selectedIds.has(row.jobId)}
                                        onChange={() => onToggle(row.jobId)}
                                        disabled={isApplying || row.ratedManually}
                                        aria-label={`Update price for ${row.jobNo}`}
                                    />
                                    <Text size="sm" fw={500} style={{flex: 1}}>{row.jobNo}</Text>
                                    {row.ratedManually && (
                                        <Badge size="sm" variant="outline" color="gray" tt="none">Manual price</Badge>
                                    )}
                                    <Text size="sm" c="dimmed">
                                        {formatMoney(row.oldPrice)} → {formatMoney(row.newPrice)}
                                    </Text>
                                    <PriceDelta oldPrice={row.oldPrice} newPrice={row.newPrice}/>
                                </Group>
                            </React.Fragment>
                        ))}
                    </Paper>

                    {selectedCount > 0 && (
                        <Text size="sm" c="dimmed">
                            Net change: <strong>{netDelta >= 0 ? '+' : ''}{netDelta.toFixed(2)}</strong>
                        </Text>
                    )}
                </Stack>
            </Box>
            <DialogFooter
                onCancel={onKeepAll}
                cancelLabel="Keep all"
                onConfirm={onAcceptSelected}
                confirmLabel={`Accept selected (${selectedCount})`}
                confirmIcon={<Icon lucide={Check} size={16}/>}
                confirmDisabled={selectedCount === 0}
                submitting={isApplying}
            />
        </DialogShell>
    );
};

export default FamilyPriceChangeDialog;
