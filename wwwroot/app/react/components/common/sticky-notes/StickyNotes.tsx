/**
 * StickyNotes Component
 *
 * React class component for displaying and managing job notes with a sticky note design.
 */

import React from 'react';
import {
    Box,
    IconButton,
    Tooltip,
    LinearProgress,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Typography,
    Paper,
} from '@mui/material';
import {StickyNotesProps} from './StickyNotes.interfaces';
import {JobNote, NoteType} from '../../../interfaces';
import {notesApi} from '../../../services/notesApi';

interface StickyNotesState {
    notes: JobNote[];
    noteCategories: NoteType[];
    selectedCategory: string;
    loading: boolean;
    categoriesLoading: boolean;
    menuAnchorEl: HTMLElement | null;
}

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

export class StickyNotes extends React.Component<StickyNotesProps, StickyNotesState> {
    static defaultProps: Partial<StickyNotesProps> = {
        isRecurringJob: false,
        isUsCustomer: true,
    };

    constructor(props: StickyNotesProps) {
        super(props);
        this.state = {
            notes: [],
            noteCategories: [],
            selectedCategory: 'all',
            loading: false,
            categoriesLoading: true,
            menuAnchorEl: null,
        };
    }

    componentDidMount(): void {
        this.loadNoteCategories();
        this.loadNotes();
    }

    componentDidUpdate(prevProps: StickyNotesProps): void {
        // Reload notes when jobId or bulkJobId changes
        if (prevProps.jobId !== this.props.jobId ||
            prevProps.bulkJobId !== this.props.bulkJobId ||
            prevProps.isRecurringJob !== this.props.isRecurringJob) {
            this.loadNotes();
        }
    }

    private get themeColor(): string {
        return this.props.isUsCustomer ? '#1976d2' : '#f9a825';
    }

    private get filteredNotes(): JobNote[] {
        const {notes, selectedCategory} = this.state;
        if (selectedCategory === 'all') {
            return notes;
        }
        const categoryId = parseInt(selectedCategory);
        return notes.filter(note => note.noteTypeId === categoryId);
    }

    private get isFilterActive(): boolean {
        return this.state.selectedCategory !== 'all';
    }

    private loadNoteCategories = async (): Promise<void> => {
        this.setState({categoriesLoading: true});
        try {
            const types = await notesApi.getNoteTypes();
            this.setState({noteCategories: types});
        } catch (error) {
            console.error('Error loading note categories:', error);
        } finally {
            this.setState({categoriesLoading: false});
        }
    };

    private loadNotes = async (): Promise<void> => {
        const {jobId, bulkJobId, isRecurringJob, showErrorToast} = this.props;

        if (!jobId && !bulkJobId) return;

        this.setState({loading: true});
        try {
            let fetchedNotes: JobNote[];
            if (bulkJobId) {
                fetchedNotes = await notesApi.getBulkJobNotes(bulkJobId);
            } else if (jobId) {
                fetchedNotes = await notesApi.getJobNotes(jobId, isRecurringJob ?? false);
            } else {
                fetchedNotes = [];
            }
            this.setState({notes: fetchedNotes});
        } catch (error) {
            console.error('Error loading notes:', error);
            showErrorToast?.('Failed to load notes');
        } finally {
            this.setState({loading: false});
        }
    };

    private getCategoryName = (): string => {
        const {selectedCategory, noteCategories} = this.state;
        if (selectedCategory === 'all') {
            return 'All Categories';
        }
        const category = noteCategories.find(cat => cat.id?.toString() === selectedCategory);
        return category?.text || 'Unknown Category';
    };

    private getNoNotesMessage = (): string => {
        const {notes} = this.state;
        if (notes.length > 0 && this.isFilterActive) {
            return `No ${this.getCategoryName()} notes found`;
        } else if (notes.length === 0) {
            return 'No notes available for this job';
        }
        return 'No notes found. Click "Add Note" to add a new note';
    };

    private getCategoryNoteCount = (categoryId?: number): number => {
        const {notes} = this.state;
        if (categoryId === undefined) {
            return notes.length;
        }
        return notes.filter(note => note.noteTypeId === categoryId).length;
    };

    private handleFilterByCategory = (category: string | NoteType): void => {
        if (typeof category === 'string') {
            this.setState({selectedCategory: category, menuAnchorEl: null});
        } else {
            this.setState({
                selectedCategory: category.id?.toString() || 'all',
                menuAnchorEl: null,
            });
        }
    };

    private handleAddNote = async (event: React.MouseEvent<HTMLElement>): Promise<void> => {
        const {jobId, bulkJobId, isRecurringJob, noteManagementDialogService, showSuccessToast} = this.props;

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
            await this.loadNotes();
            showSuccessToast?.('Note added successfully');
        } catch (error) {
            // Dialog was canceled
            if (!error) return;
            console.error('Error adding note:', error);
        }
    };

    private handleEditNote = async (event: React.MouseEvent<HTMLElement>, note: JobNote): Promise<void> => {
        const {noteManagementDialogService, showSuccessToast} = this.props;

        try {
            await noteManagementDialogService.openNoteDialog(event.nativeEvent, note);
            await this.loadNotes();
            showSuccessToast?.('Note updated successfully');
        } catch (error) {
            // Dialog was canceled
            if (!error) return;
            console.error('Error editing note:', error);
        }
    };

    private handleDeleteNote = async (event: React.MouseEvent<HTMLElement>, note: JobNote): Promise<void> => {
        event.stopPropagation();
        const {showSuccessToast, showErrorToast} = this.props;

        const confirmed = window.confirm('Are you sure you want to delete this note?');
        if (!confirmed) return;

        try {
            await notesApi.deleteNote(note.noteId ?? 0);
            await this.loadNotes();
            showSuccessToast?.('Note deleted successfully');
        } catch (error) {
            console.error('Error deleting note:', error);
            showErrorToast?.('Failed to delete note');
        }
    };

    private handleOpenMenu = (event: React.MouseEvent<HTMLElement>): void => {
        this.setState({menuAnchorEl: event.currentTarget});
    };

    private handleCloseMenu = (): void => {
        this.setState({menuAnchorEl: null});
    };

    private handleClearFilter = (): void => {
        this.setState({selectedCategory: 'all'});
    };

    render(): React.ReactNode {
        const {loading, categoriesLoading, noteCategories, selectedCategory, menuAnchorEl} = this.state;
        const filteredNotes = this.filteredNotes;
        const isFilterActive = this.isFilterActive;
        const themeColor = this.themeColor;

        return (
            <Box className="sticky-notes" sx={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                {/* Header Toolbar */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1,
                        bgcolor: themeColor,
                        color: 'white',
                        minHeight: 48,
                    }}
                >
                    <span className="material-symbols-outlined" style={{marginRight: 8}}>note</span>
                    <Typography variant="subtitle1" sx={{fontWeight: 500, flex: 1}}>
                        Notes
                        {isFilterActive && (
                            <Typography component="span" variant="body2" sx={{ml: 1, opacity: 0.9}}>
                                - {this.getCategoryName()}
                            </Typography>
                        )}
                    </Typography>

                    {/* Category Filter Button */}
                    <Tooltip title="Filter by Category">
                        <span>
                            <IconButton
                                size="small"
                                onClick={this.handleOpenMenu}
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
                        onClose={this.handleCloseMenu}
                    >
                        {noteCategories.length === 0 ? (
                            <MenuItem disabled>
                                <Typography variant="body2">No note categories available.</Typography>
                            </MenuItem>
                        ) : (
                            <>
                                <MenuItem
                                    onClick={() => this.handleFilterByCategory('all')}
                                    selected={selectedCategory === 'all'}
                                >
                                    <ListItemIcon>
                                        <span className="material-symbols-outlined">topic</span>
                                    </ListItemIcon>
                                    <ListItemText>All Categories</ListItemText>
                                    <Typography variant="body2" color="text.secondary" sx={{ml: 1}}>
                                        ({this.getCategoryNoteCount()})
                                    </Typography>
                                </MenuItem>
                                <Divider />
                                {noteCategories.map(category => (
                                    <MenuItem
                                        key={category.id}
                                        onClick={() => this.handleFilterByCategory(category)}
                                        selected={selectedCategory === category.id?.toString()}
                                    >
                                        <ListItemIcon>
                                            <span className="material-symbols-outlined">topic</span>
                                        </ListItemIcon>
                                        <ListItemText>{category.text}</ListItemText>
                                        <Typography variant="body2" color="text.secondary" sx={{ml: 1}}>
                                            ({this.getCategoryNoteCount(category.id)})
                                        </Typography>
                                    </MenuItem>
                                ))}
                            </>
                        )}
                    </Menu>

                    {/* Add Note Button */}
                    <Tooltip title="Add Note">
                        <IconButton size="small" onClick={this.handleAddNote} sx={{color: 'white'}}>
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
                        bgcolor: '#fafafa',
                        minHeight: 120,
                        flex: 1,
                        overflow: 'auto',
                    }}
                >
                    {/* Notes */}
                    {filteredNotes.map((note, index) => (
                        <Paper
                            key={note.noteId || index}
                            onClick={(e) => this.handleEditNote(e, note)}
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
                                        onClick={(e) => this.handleDeleteNote(e, note)}
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
                                {this.getNoNotesMessage()}
                            </Typography>
                            {isFilterActive && (
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: themeColor,
                                        cursor: 'pointer',
                                        '&:hover': {textDecoration: 'underline'},
                                    }}
                                    onClick={this.handleClearFilter}
                                >
                                    Show all notes
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>
        );
    }
}

export default StickyNotes;
