/**
 * DeliveryEventDetailsDialog
 *
 * Read-only dialog that shows the full details of a single delivery-journey
 * event. Used when timeline rows are clicked, so users can inspect content
 * (addresses, long tag strings, notes) that gets truncated in the compact
 * timeline view. Follows the dialog design language documented in CLAUDE.md.
 */

import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {alpha} from '@mui/material/styles';
import NotesIcon from '@mui/icons-material/Notes';

import {DeliveryJourney} from './TaskHistory.interfaces';
import {getEventIcon} from './eventIcons';
import {formatCurrency} from '../../../utils/currencyUtils';
import {DialogShell, DialogHeader, sectionPaperSx, sectionLabelSx} from '../../dialogs/shared';

interface DeliveryEventDetailsDialogProps {
    open: boolean;
    event: DeliveryJourney | null;
    timeZoneShort: string;
    onClose: () => void;
}

type StatusKey = DeliveryJourney['status'];
type StatusToneKey = 'success' | 'info' | 'warning' | 'error' | 'default';

const STATUS_LABEL: Record<StatusKey, string> = {
    completed: 'Completed',
    current: 'In progress',
    todo: 'To do',
    pending: 'Pending',
    waiting: 'Waiting',
};

const STATUS_TONE: Record<StatusKey, StatusToneKey> = {
    completed: 'success',
    current: 'info',
    todo: 'error',
    pending: 'warning',
    waiting: 'default',
};

export const DeliveryEventDetailsDialog: React.FC<DeliveryEventDetailsDialogProps> = ({
                                                                                          open,
                                                                                          event,
                                                                                          timeZoneShort,
                                                                                          onClose,
                                                                                      }) => {
    if (!event) return null;

    const Icon = getEventIcon(event.icon);
    // event.status is on the TS interface but the backend ViewModel does not
    // populate it — only render the chip if a real label resolves.
    const statusLabel = event.status ? STATUS_LABEL[event.status] : undefined;
    const statusTone = event.status ? STATUS_TONE[event.status] : undefined;
    const hasTotal = event.grandTotalAfter != null;
    const showSummary = Boolean(statusLabel) || hasTotal;

    // Only show description if it adds something beyond the title
    const showDescription = event.description && event.description.trim() !== event.title.trim();

    return (
        <DialogShell open={open} onClose={onClose}>
            <DialogHeader
                icon={<Icon/>}
                title={event.title}
                subtitle={
                    <>
                        {event._dateStr}
                        {timeZoneShort && (
                            <Box component="span" sx={{ml: 0.5, opacity: 0.85}}>
                                &middot; {timeZoneShort}
                            </Box>
                        )}
                        {event.performedBy && (
                            <Box component="span" sx={{ml: 0.5, opacity: 0.85}}>
                                &middot; by {event.performedBy}
                            </Box>
                        )}
                    </>
                }
                onClose={onClose}
            />

            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {/* Status + Total summary — rendered only when there's
                        something real to show (status is often absent in
                        production data; total only appears on pricing events). */}
                    {showSummary && (
                        <Box>
                            <Typography variant="body2" sx={sectionLabelSx}>Summary</Typography>
                            <Paper elevation={0} sx={sectionPaperSx}>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    useFlexGap
                                    sx={{flexWrap: 'wrap', alignItems: 'center'}}
                                >
                                    {statusLabel && (
                                        <Chip
                                            label={statusLabel}
                                            size="small"
                                            color={statusTone === 'default' || !statusTone ? 'default' : statusTone}
                                        />
                                    )}
                                    {hasTotal && (
                                        <Chip
                                            label={`Total: ${formatCurrency(event.grandTotalAfter!)}`}
                                            size="small"
                                            color="success"
                                            variant="filled"
                                        />
                                    )}
                                </Stack>
                            </Paper>
                        </Box>
                    )}

                    {/* Description (if it adds info beyond the title) */}
                    {showDescription && (
                        <Box>
                            <Typography variant="body2" sx={sectionLabelSx}>Description</Typography>
                            <Paper elevation={0} sx={sectionPaperSx}>
                                <Typography
                                    variant="body2"
                                    sx={{color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}
                                >
                                    {event.description}
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                    {/* All tags, full text */}
                    {event.tags && event.tags.length > 0 && (
                        <Box>
                            <Typography variant="body2" sx={sectionLabelSx}>Details</Typography>
                            <Paper elevation={0} sx={sectionPaperSx}>
                                <Stack spacing={1}>
                                    {event.tags.map((tag, i) => (
                                        <Box
                                            key={i}
                                            sx={(theme) => ({
                                                fontSize: '0.875rem',
                                                color: 'text.primary',
                                                bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                borderRadius: 1,
                                                p: 1,
                                                wordBreak: 'break-word',
                                            })}
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
                            <Typography variant="body2" sx={sectionLabelSx}>Notes</Typography>
                            <Alert
                                severity="info"
                                variant="outlined"
                                icon={<NotesIcon fontSize="small"/>}
                                sx={{'& .MuiAlert-message': {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}}
                            >
                                {event.notes}
                            </Alert>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: 'white',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button onClick={onClose} variant="outlined" sx={{minWidth: 100}}>
                    Close
                </Button>
            </DialogActions>
        </DialogShell>
    );
};

export default DeliveryEventDetailsDialog;
