import React, {useState} from 'react';
import {
    Box,
    Typography,
    Collapse,
    Button,
    Paper,
    CircularProgress,
    Chip,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    History as HistoryIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import {NoteHistoryEntry} from '../../../interfaces';

interface NoteHistoryProps {
    history: NoteHistoryEntry[];
    isLoading: boolean;
    timeZoneAbbr: string;
}

export const NoteHistory: React.FC<NoteHistoryProps> = ({history, isLoading, timeZoneAbbr}) => {
    const [expanded, setExpanded] = useState(false);

    if (isLoading) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 2}}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                    Loading edit history...
                </Typography>
            </Box>
        );
    }

    if (history.length === 0) return null;

    return (
        <Box sx={{mt: 2}}>
            <Button
                size="small"
                onClick={() => setExpanded(!expanded)}
                startIcon={<HistoryIcon fontSize="small" />}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{textTransform: 'none', color: 'text.secondary', mb: 1}}
            >
                Edit History ({history.length})
            </Button>

            <Collapse in={expanded}>
                <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        maxHeight: 300,
                        overflowY: 'auto',
                        pr: 0.5,
                        '&::-webkit-scrollbar': {width: 6},
                        '&::-webkit-scrollbar-track': {bgcolor: 'grey.100', borderRadius: 3},
                        '&::-webkit-scrollbar-thumb': {
                            bgcolor: 'grey.300',
                            borderRadius: 3,
                            '&:hover': {bgcolor: 'grey.400'},
                        },
                    }}>
                    {history.map((entry) => (
                        <Paper
                            key={entry.noteHistoryId}
                            variant="outlined"
                            sx={{p: 2, borderRadius: 2}}
                        >
                            {/* Header */}
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
                                <EditIcon fontSize="small" color="action" />
                                <Typography variant="body2" fontWeight={600}>
                                    {entry.editedByName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {entry.editedAtStr} {timeZoneAbbr}
                                </Typography>
                            </Box>

                            {/* Text change */}
                            {entry.oldNoteText !== entry.newNoteText && (
                                <Box sx={{mb: 1}}>
                                    <Typography variant="caption" color="text.secondary" sx={{textTransform: 'uppercase', letterSpacing: 0.5}}>
                                        Text changed
                                    </Typography>
                                    <Box
                                        sx={{
                                            mt: 0.5,
                                            p: 1.5,
                                            bgcolor: 'grey.100',
                                            borderRadius: 1,
                                            borderLeft: 3,
                                            borderColor: 'error.light',
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary" sx={{whiteSpace: 'pre-wrap'}}>
                                            {entry.oldNoteText}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Type change */}
                            {entry.oldNoteTypeId !== entry.newNoteTypeId && (
                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                                    <Typography variant="caption" color="text.secondary">
                                        Type:
                                    </Typography>
                                    <Chip label={entry.oldNoteTypeName ?? 'Unknown'} size="small" variant="outlined" color="default" />
                                    <Typography variant="caption" color="text.secondary">
                                        &rarr;
                                    </Typography>
                                    <Chip label={entry.newNoteTypeName ?? 'Unknown'} size="small" variant="outlined" color="primary" />
                                </Box>
                            )}

                            {/* Importance change */}
                            {entry.oldIsImportant !== entry.newIsImportant && (
                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                    <Typography variant="caption" color="text.secondary">
                                        Important:
                                    </Typography>
                                    <Chip
                                        label={entry.newIsImportant ? 'Marked important' : 'Unmarked important'}
                                        size="small"
                                        color={entry.newIsImportant ? 'warning' : 'default'}
                                        variant="outlined"
                                    />
                                </Box>
                            )}
                        </Paper>
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
};

export default NoteHistory;
