/**
 * DeliveryEventDetailsDialog
 *
 * Read-only dialog that shows the full details of a single delivery-journey
 * event. Used when timeline rows are clicked, so users can inspect content
 * (addresses, long tag strings, notes) that gets truncated in the compact
 * timeline view. Follows the dialog design language documented in CLAUDE.md.
 */

import React from 'react';
import {Alert, Badge, Box, Group, Paper, Stack, Text} from '@mantine/core';
import {NotebookPen} from 'lucide-react';

import {DeliveryJourney} from './TaskHistory.interfaces';
import {EventIcon} from './eventIcons';
import {formatCurrency} from '../../../utils/currencyUtils';
import {Icon} from '../icon/Icon';
import {
    DialogFooter, DialogHeader, DialogShell, dialogContentBg, sectionLabelProps, sectionPaperProps,
} from '../../dialogs/shared/mantine';

interface DeliveryEventDetailsDialogProps {
    open: boolean;
    event: DeliveryJourney | null;
    timeZoneShort: string;
    onClose: () => void;
}

type StatusKey = DeliveryJourney['status'];

const STATUS_LABEL: Record<StatusKey, string> = {
    completed: 'Completed',
    current: 'In progress',
    todo: 'To do',
    pending: 'Pending',
    waiting: 'Waiting',
};

/** Mantine colour per status — `gray` is the neutral the MUI `default` chip was. */
const STATUS_TONE: Record<StatusKey, string> = {
    completed: 'green',
    current: 'blue',
    todo: 'red',
    pending: 'orange',
    waiting: 'gray',
};

export const DeliveryEventDetailsDialog: React.FC<DeliveryEventDetailsDialogProps> = ({
                                                                                          open,
                                                                                          event,
                                                                                          timeZoneShort,
                                                                                          onClose,
                                                                                      }) => {
    if (!event) return null;

    // event.status is on the TS interface but the backend ViewModel does not
    // populate it — only render the chip if a real label resolves.
    const statusLabel = event.status ? STATUS_LABEL[event.status] : undefined;
    const statusTone = event.status ? STATUS_TONE[event.status] : undefined;
    const hasTotal = event.grandTotalAfter != null;
    const showSummary = Boolean(statusLabel) || hasTotal;

    // Only show description if it adds something beyond the title
    const showDescription = event.description && event.description.trim() !== event.title.trim();

    return (
        <DialogShell opened={open} onClose={onClose} label={event.title}>
            <DialogHeader
                icon={<EventIcon name={event.icon}/>}
                title={event.title}
                subtitle={
                    <>
                        {event._dateStr}
                        {timeZoneShort && (
                            <Box component="span" ml={4} opacity={0.85}>
                                &middot; {timeZoneShort}
                            </Box>
                        )}
                        {event.performedBy && (
                            <Box component="span" ml={4} opacity={0.85}>
                                &middot; by {event.performedBy}
                            </Box>
                        )}
                    </>
                }
                onClose={onClose}
            />

            <Box p="lg" bg={dialogContentBg}>
                <Stack gap="lg">
                    {/* Status + Total summary — rendered only when there's
                        something real to show (status is often absent in
                        production data; total only appears on pricing events). */}
                    {showSummary && (
                        <Box>
                            <Text {...sectionLabelProps}>Summary</Text>
                            <Paper {...sectionPaperProps}>
                                <Group gap="xs" wrap="wrap">
                                    {statusLabel && (
                                        <Badge color={statusTone} variant="filled" size="sm" tt="none">
                                            {statusLabel}
                                        </Badge>
                                    )}
                                    {hasTotal && (
                                        <Badge color="green" variant="filled" size="sm" tt="none">
                                            {`Total: ${formatCurrency(event.grandTotalAfter!)}`}
                                        </Badge>
                                    )}
                                </Group>
                            </Paper>
                        </Box>
                    )}

                    {/* Description (if it adds info beyond the title) */}
                    {showDescription && (
                        <Box>
                            <Text {...sectionLabelProps}>Description</Text>
                            <Paper {...sectionPaperProps}>
                                <Text size="sm" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                                    {event.description}
                                </Text>
                            </Paper>
                        </Box>
                    )}

                    {/* All tags, full text */}
                    {event.tags && event.tags.length > 0 && (
                        <Box>
                            <Text {...sectionLabelProps}>Details</Text>
                            <Paper {...sectionPaperProps}>
                                <Stack gap="xs">
                                    {event.tags.map((tag, i) => (
                                        <Box
                                            key={i}
                                            fz="sm"
                                            p="xs"
                                            bg="var(--mantine-primary-color-light)"
                                            style={{
                                                borderRadius: 'var(--mantine-radius-sm)',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {tag}
                                        </Box>
                                    ))}
                                </Stack>
                            </Paper>
                        </Box>
                    )}

                    {/* Notes */}
                    {event.notes && (
                        <Box>
                            <Text {...sectionLabelProps}>Notes</Text>
                            <Alert
                                color="blue"
                                variant="outline"
                                icon={<Icon lucide={NotebookPen} size={18}/>}
                                styles={{message: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}}
                            >
                                {event.notes}
                            </Alert>
                        </Box>
                    )}
                </Stack>
            </Box>

            <DialogFooter onCancel={onClose} cancelLabel="Close" hideConfirm/>
        </DialogShell>
    );
};

export default DeliveryEventDetailsDialog;
