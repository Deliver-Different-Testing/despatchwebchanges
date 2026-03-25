/**
 * StickyNotes Component
 *
 * React functional component for displaying and managing job notes with a sticky note design.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import {StickyNotesProps} from './StickyNotes.interfaces';
import {JobNote, NoteType} from '../../../interfaces';
import {notesApi} from '../../../services/notesApi';

/**
 * Get note type color based on type name and importance
 */
function getNoteTypeColor(noteTypeName?: string, isImportant?: boolean): string {
    if (isImportant) return '#ffccbc'; // Orange for important

    const typeLower = noteTypeName?.toLowerCase() || '';
    switch (typeLower) {
        case 'internal':
            return '#fff9c4'; // Yellow
        case 'consignment':
            return '#bbdefb'; // Blue
        case 'client':
            return '#c8e6c9'; // Green
        default:
            return '#e1f5fe'; // Light blue default
    }
}

export const StickyNotes: React.FC<StickyNotesProps> = ({
    jobId,
    bulkJobId,
    isRecurringJob = false,
    showErrorToast,
    showSuccessToast,
    noteManagementDialogService,
}) => {
    const [notes, setNotes] = useState<JobNote[]>([]);
    const [noteCategories, setNoteCategories] = useState<NoteType[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [loading, setLoading] = useState(false);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

    const filteredNotes = useMemo(() => {
        if (selectedCategory === 'all') return notes;
        const categoryId = parseInt(selectedCategory);
        return notes.filter(note => note.noteTypeId === categoryId);
    }, [notes, selectedCategory]);

    const isFilterActive = selectedCategory !== 'all';

    const loadNotes = useCallback(async (): Promise<void> => {
        if (!jobId && !bulkJobId) return;

        setLoading(true);
        try {
            let fetchedNotes: JobNote[];
            if (bulkJobId) {
                fetchedNotes = await notesApi.getBulkJobNotes(bulkJobId);
            } else if (jobId) {
                fetchedNotes = await notesApi.getJobNotes(jobId, isRecurringJob);
            } else {
                fetchedNotes = [];
            }
            setNotes(fetchedNotes);
        } catch (error) {
            console.error('Error loading notes:', error);
            showErrorToast?.('Failed to load notes');
        } finally {
            setLoading(false);
        }
    }, [jobId, bulkJobId, isRecurringJob, showErrorToast]);

    // Load note categories on mount
    useEffect(() => {
        const loadNoteCategories = async (): Promise<void> => {
            setCategoriesLoading(true);
            try {
                const types = await notesApi.getNoteTypes();
                setNoteCategories(types);
            } catch (error) {
                console.error('Error loading note categories:', error);
            } finally {
                setCategoriesLoading(false);
            }
        };
        loadNoteCategories();
    }, []);

    // Load notes on mount and when jobId/bulkJobId/isRecurringJob changes
    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const getCategoryName = (): string => {
        if (selectedCategory === 'all') return 'All Categories';
        const category = noteCategories.find(cat => cat.id?.toString() === selectedCategory);
        return category?.text || 'Unknown Category';
    };

    const getNoNotesMessage = (): string => {
        if (notes.length > 0 && isFilterActive) {
            return `No ${getCategoryName()} notes found`;
        } else if (notes.length === 0) {
            return 'No notes available for this job';
        }
        return 'No notes found. Click "Add Note" to add a new note';
    };

    const getCategoryNoteCount = (categoryId?: number): number => {
        if (categoryId === undefined) return notes.length;
        return notes.filter(note => note.noteTypeId === categoryId).length;
    };

    const handleFilterByCategory = (category: string | NoteType): void => {
        if (typeof category === 'string') {
            setSelectedCategory(category);
        } else {
            setSelectedCategory(category.id?.toString() || 'all');
        }
        setMenuAnchorEl(null);
    };

    const handleAddNote = async (event: React.MouseEvent<HTMLElement>): Promise<void> => {
        const emptyNote: JobNote = {
            noteId: 0,
            noteTypeId: 0,
            noteText: '',
            isImportant: false,
            jobId: !isRecurringJob ? jobId : undefined,
            jobBookingId: isRecurringJob ? jobId : undefined,
            bulkJobId: bulkJobId ?? undefined,
        };

        try {
            await noteManagementDialogService.openNoteDialog(event.nativeEvent, emptyNote);
            await loadNotes();
        } catch (error) {
            // Dialog was canceled
            if (!error) return;
            console.error('Error adding note:', error);
        }
    };

    const handleEditNote = async (event: React.MouseEvent<HTMLElement>, note: JobNote): Promise<void> => {
        try {
            await noteManagementDialogService.openNoteDialog(event.nativeEvent, note);
            await loadNotes();
        } catch (error) {
            // Dialog was canceled
            if (!error) return;
            console.error('Error editing note:', error);
        }
    };

    const handleDeleteNote = async (event: React.MouseEvent<HTMLElement>, note: JobNote): Promise<void> => {
        event.stopPropagation();

        const confirmed = window.confirm('Are you sure you want to delete this note?');
        if (!confirmed) return;

        try {
            await notesApi.deleteNote(note.noteId ?? 0);
            await loadNotes();
            showSuccessToast?.('Note deleted successfully');
        } catch (error) {
            console.error('Error deleting note:', error);
            showErrorToast?.('Failed to delete note');
        }
    };

    const handleClearFilter = (): void => {
        setSelectedCategory('all');
    };

    return (
        <Box className="sticky-notes" sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
            {/* Header Toolbar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    bgcolor: 'primary.main',
                    color: 'white',
                    minHeight: 48,
                }}
            >
                <span className="material-symbols-outlined" style={{marginRight: 8}}>note</span>
                <Typography variant="subtitle1" sx={{fontWeight: 500, flex: 1}}>
                    Notes
                    {isFilterActive && (
                        <Typography component="span" variant="body2" sx={{ml: 1, opacity: 0.9}}>
                            - {getCategoryName()}
                        </Typography>
                    )}
                </Typography>

                {/* Category Filter Button */}
                <Tooltip title="Filter by Category">
                    <span>
                        <IconButton
                            size="small"
                            onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                            disabled={categoriesLoading}
                            sx={{color: 'white'}}
                        >
                            {categoriesLoading ? (
                                <Box sx={{width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    <LinearProgress sx={{width: 18}} />
                                </Box>
                            ) : (
                                <span className="material-symbols-outlined">
                                    {isFilterActive ? 'filter_alt' : 'category'}
                                </span>
                            )}
                        </IconButton>
                    </span>
                </Tooltip>

                {/* Category Menu */}
                <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={() => setMenuAnchorEl(null)}
                >
                    {noteCategories.length === 0 ? (
                        <MenuItem disabled>
                            <Typography variant="body2">No note categories available.</Typography>
                        </MenuItem>
                    ) : ([
                        <MenuItem
                            key="all"
                            onClick={() => handleFilterByCategory('all')}
                            selected={selectedCategory === 'all'}
                        >
                            <ListItemIcon>
                                <span className="material-symbols-outlined">topic</span>
                            </ListItemIcon>
                            <ListItemText>All Categories</ListItemText>
                            <Typography variant="body2" color="text.secondary" sx={{ml: 1}}>
                                ({getCategoryNoteCount()})
                            </Typography>
                        </MenuItem>,
                        <Divider key="divider" />,
                        ...noteCategories.map(category => (
                            <MenuItem
                                key={category.id}
                                onClick={() => handleFilterByCategory(category)}
                                selected={selectedCategory === category.id?.toString()}
                            >
                                <ListItemIcon>
                                    <span className="material-symbols-outlined">topic</span>
                                </ListItemIcon>
                                <ListItemText>{category.text}</ListItemText>
                                <Typography variant="body2" color="text.secondary" sx={{ml: 1}}>
                                    ({getCategoryNoteCount(category.id)})
                                </Typography>
                            </MenuItem>
                        )),
                    ])}
                </Menu>

                {/* Add Note Button */}
                <Tooltip title="Add Note">
                    <IconButton size="small" onClick={handleAddNote} sx={{color: 'white'}}>
                        <span className="material-symbols-outlined">note_add</span>
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Loading Indicator */}
            {loading && <LinearProgress sx={{height: 2}} />}

            {/* Notes Container */}
            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    bgcolor: 'background.default',
                    minHeight: 120,
                    flex: 1,
                    overflow: 'auto',
                }}
            >
                {/* Notes */}
                {filteredNotes.map((note, index) => (
                    <Paper
                        key={note.noteId || index}
                        onClick={(e) => handleEditNote(e, note)}
                        sx={{
                            width: 'calc(50% - 8px)',
                            minWidth: 200,
                            p: 2,
                            position: 'relative',
                            minHeight: 120,
                            cursor: 'pointer',
                            transform: `rotate(${-1 + (index % 3)}deg)`,
                            transition: 'all 0.2s ease',
                            bgcolor: getNoteTypeColor(note.noteTypeName, note.isImportant),
                            '&:hover': {
                                transform: 'scale(1.02) rotate(0deg)',
                                boxShadow: 3,
                                zIndex: 2,
                                '& .note-actions': {
                                    opacity: 1,
                                },
                            },
                            // Tape effect
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                top: -8,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '40%',
                                height: 16,
                                bgcolor: 'rgba(0, 0, 0, 0.1)',
                                opacity: 0.5,
                            },
                        }}
                        elevation={1}
                    >
                        {/* Note Header */}
                        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <span
                                    className="material-symbols-outlined"
                                    style={{marginRight: 8, color: 'rgba(0,0,0,0.6)', fontSize: 20}}
                                >
                                    {note.isImportant ? 'priority_high' : 'note'}
                                </span>
                                <Typography variant="body2" sx={{fontWeight: 500, color: 'rgba(0,0,0,0.7)'}}>
                                    {note.noteTypeName || 'Note'}
                                </Typography>
                            </Box>
                            <Typography variant="caption" sx={{color: 'rgba(0,0,0,0.54)'}}>
                                {note._createdDateStr}
                            </Typography>
                        </Box>

                        {/* Note Content */}
                        <Typography
                            variant="body2"
                            sx={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: 'rgba(0,0,0,0.8)',
                                lineHeight: 1.5,
                            }}
                        >
                            {note.noteText}
                        </Typography>

                        {/* Delete Action */}
                        <Box
                            className="note-actions"
                            sx={{
                                position: 'absolute',
                                bottom: 8,
                                right: 8,
                                opacity: 0,
                                transition: 'opacity 0.2s ease',
                            }}
                        >
                            <Tooltip title="Delete Note">
                                <IconButton
                                    size="small"
                                    onClick={(e) => handleDeleteNote(e, note)}
                                >
                                    <span className="material-symbols-outlined" style={{fontSize: 20}}>
                                        delete
                                    </span>
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Paper>
                ))}

                {/* Empty State */}
                {!loading && filteredNotes.length === 0 && (
                    <Box
                        sx={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 200,
                            color: 'text.secondary',
                        }}
                    >
                        <span
                            className="material-symbols-outlined"
                            style={{fontSize: 48, marginBottom: 8, opacity: 0.5}}
                        >
                            sticky_note_2
                        </span>
                        <Typography variant="subtitle1" gutterBottom>
                            No Notes
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                            {getNoNotesMessage()}
                        </Typography>
                        {isFilterActive && (
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'primary.main',
                                    cursor: 'pointer',
                                    '&:hover': {textDecoration: 'underline'},
                                }}
                                onClick={handleClearFilter}
                            >
                                Show all notes
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default StickyNotes;
