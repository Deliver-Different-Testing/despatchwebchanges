/**
 * React Note Management Dialog
 *
 * A dialog for creating and editing job notes with note type management.
 * Supports creating new note types inline and displays note metadata.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {alpha} from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import DialogContent from '@mui/material/DialogContent';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import PersonIcon from '@mui/icons-material/Person';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/Schedule';
import NoteIcon from '@mui/icons-material/StickyNote2';
import UpdateIcon from '@mui/icons-material/Update';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';
import {CreateNoteRequest, NoteType, UpdateNoteRequest} from '../../../interfaces';
import {getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {NoteManagementDialogProps} from "./types";
import {useNoteHistory} from '../../../hooks/useNotesApi';
import {NoteHistory} from './NoteHistory';
import {AiDraftButton} from '../../common/ai-draft-button/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {draftNote} from '../../../services/aiAssistantApi';

const MAX_NOTE_LENGTH = 1000;
const MAX_DESCRIPTION_LENGTH = 500;

export const NoteManagementDialog: React.FC<NoteManagementDialogProps> = ({
    open,
    note,
    onClose,
    onSave,
    onLoadNoteTypes,
    onCreateNote,
    onUpdateNote,
    onCreateNoteType,
    showToast,
}) => {
    // Form state
    const [noteText, setNoteText] = useState('');
    const [noteTypeId, setNoteTypeId] = useState<number>(0);
    const [isImportant, setIsImportant] = useState(false);
    const {runDraft, isDrafting} = useAiDraft();

    const handleDraftNote = async () => {
        const result = await runDraft((signal) =>
            draftNote(
                {
                    jobId: note?.jobId,
                    jobBookingId: note?.jobBookingId,
                    bulkJobId: note?.bulkJobId,
                    noteTypeId,
                    seed: noteText,
                },
                {signal},
            ),
        );
        if (result) {
            setNoteText(result.draft.slice(0, MAX_NOTE_LENGTH));
        }
    };

    // Note types state
    const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
    const [isLoadingTypes, setIsLoadingTypes] = useState(false);

    // Note type creator state
    const [showNoteTypeCreator, setShowNoteTypeCreator] = useState(false);
    const [newNoteTypeName, setNewNoteTypeName] = useState('');
    const [newNoteTypeDescription, setNewNoteTypeDescription] = useState('');
    const [newNoteTypeIsPublic, setNewNoteTypeIsPublic] = useState(false);
    const [newNoteTypeIsCourierFacing, setNewNoteTypeIsCourierFacing] = useState(false);
    const [isCreatingNoteType, setIsCreatingNoteType] = useState(false);

    // Description toggle
    const [showDescription, setShowDescription] = useState(false);

    // Submit state
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isNew = !note?.noteId;
    const title = isNew ? 'Add Note' : 'Edit Note';

    // Timezone for metadata display
    const formattedTimeZone = useMemo(() => {
        return getTimezoneAbbreviation((window as unknown as Record<string, string>).TimeZone || '');
    }, []);

    // Edit history
    const noteSource = note?.bulkJobId ? 'BulkNote' : 'Note';
    const {data: noteHistory = [], isLoading: isLoadingHistory} = useNoteHistory(
        note?.noteId,
        noteSource,
        {enabled: open && !isNew}
    );

    // Load note types when dialog opens
    useEffect(() => {
        if (open) {
            loadNoteTypes();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadNoteTypes is inline; only load on dialog open
    }, [open]);

    // Reset form when note changes or dialog opens
    useEffect(() => {
        if (open) {
            if (note) {
                setNoteText(note.noteText || '');
                setNoteTypeId(note.noteTypeId || 0);
                setIsImportant(note.isImportant || false);
            } else {
                setNoteText('');
                setNoteTypeId(0);
                setIsImportant(false);
            }
            setShowNoteTypeCreator(false);
            setShowDescription(false);
            resetNoteTypeForm();
        }
    }, [open, note]);

    // Set default note type when types are loaded
    useEffect(() => {
        if (isNew && noteTypeId === 0 && noteTypes.length > 0) {
            setNoteTypeId(noteTypes[0].id || 0);
        }
    }, [noteTypes, isNew, noteTypeId]);

    const loadNoteTypes = async () => {
        setIsLoadingTypes(true);
        try {
            const types = await onLoadNoteTypes();
            setNoteTypes(types);
        } catch (error) {
            console.error('Error loading note types:', error);
            showToast('Failed to load note types', 'error');
        } finally {
            setIsLoadingTypes(false);
        }
    };

    const resetNoteTypeForm = () => {
        setNewNoteTypeName('');
        setNewNoteTypeDescription('');
        setNewNoteTypeIsPublic(false);
        setNewNoteTypeIsCourierFacing(false);
    };

    const selectedNoteType = useMemo(() => {
        return noteTypes.find(t => t.id === noteTypeId) || null;
    }, [noteTypes, noteTypeId]);

    const isSelectedNoteTypePublic = selectedNoteType?.isPublic ?? false;
    const isSelectedNoteTypeCourierFacing = selectedNoteType?.isCourierFacing ?? false;

    const validate = (): boolean => {
        if (!noteText.trim()) {
            showToast('Note text is required', 'error');
            return false;
        }
        if (noteTypeId === 0) {
            showToast('Please select a note type', 'error');
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            if (isNew) {
                const request: CreateNoteRequest = {
                    noteTypeId,
                    noteText: noteText.trim(),
                    isImportant,
                    jobId: note?.jobId,
                    jobBookingId: note?.jobBookingId,
                    bulkJobId: note?.bulkJobId,
                };
                await onCreateNote(request);
                showToast('Note created successfully', 'success');
            } else {
                const request: UpdateNoteRequest = {
                    noteId: note!.noteId!,
                    noteTypeId,
                    noteText: noteText.trim(),
                    isImportant,
                    jobId: note?.jobId,
                    jobBookingId: note?.jobBookingId,
                    bulkJobId: note?.bulkJobId,
                };
                await onUpdateNote(request);
                showToast('Note updated successfully', 'success');
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving note:', error);
            showToast('Failed to save note', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateNoteType = async () => {
        if (!newNoteTypeName.trim()) {
            showToast('Note type name is required', 'error');
            return;
        }

        setIsCreatingNoteType(true);
        try {
            const newType: NoteType = {
                text: newNoteTypeName.trim(),
                isPublic: newNoteTypeIsPublic,
                isCourierFacing: newNoteTypeIsCourierFacing,
                description: newNoteTypeDescription.trim() || undefined,
            };

            await onCreateNoteType(newType);
            showToast('Note type created successfully', 'success');

            // Reload note types and select the new one
            const types = await onLoadNoteTypes();
            setNoteTypes(types);

            const createdType = types.find(t => t.text === newNoteTypeName.trim());
            if (createdType?.id) {
                setNoteTypeId(createdType.id);
            }

            setShowNoteTypeCreator(false);
            resetNoteTypeForm();
        } catch (error) {
            console.error('Error creating note type:', error);
            showToast('Failed to create note type', 'error');
        } finally {
            setIsCreatingNoteType(false);
        }
    };

    const isFormValid = noteText.trim() && noteTypeId > 0;

    return (
        <DialogShell
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: {
                        overflow: 'hidden',
                        minWidth: {xs: 'auto', sm: 500},
                        maxWidth: 700,
                    },
                },
            }}
        >
            <DialogHeader
                icon={<NoteIcon/>}
                title={title}
                subtitle={isNew ? 'Create a new note for this job' : 'Update an existing note'}
                onClose={onClose}
            />
            <DialogContent sx={{p: 3}}>
                {/* Note Type Section */}
                <Box sx={{mb: 3}}>
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5}}>
                        <Typography variant="subtitle1" sx={{
                            fontWeight: 600
                        }}>
                            Note Type
                        </Typography>
                        <IconButton
                            size="small"
                            aria-label="Add note type"
                            onClick={() => setShowNoteTypeCreator(!showNoteTypeCreator)}
                            sx={(theme) => ({
                                color: theme.palette.text.secondary,
                                '&:hover': {bgcolor: alpha(theme.palette.primary.main, 0.08)},
                            })}
                        >
                            <AddCircleIcon />
                        </IconButton>
                    </Box>

                    <FormControl fullWidth size="small">
                        <InputLabel>Select Note Type</InputLabel>
                        <Select
                            value={noteTypeId}
                            onChange={(e) => setNoteTypeId(e.target.value as number)}
                            label="Select Note Type"
                            disabled={isLoadingTypes}
                        >
                            {noteTypes.map((type) => (
                                <MenuItem key={type.id} value={type.id}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                        <NoteAltIcon fontSize="small" color="action" />
                                        {type.text}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Note Type Description */}
                    {selectedNoteType?.description && (
                        <Box sx={{mt: 1.5}}>
                            <Button
                                size="small"
                                onClick={() => setShowDescription(!showDescription)}
                                startIcon={showDescription ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                sx={{
                                    textTransform: 'none',
                                    color: 'text.secondary',
                                }}
                            >
                                View Description
                            </Button>
                            <Collapse in={showDescription}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        mt: 1,
                                        p: 2,
                                        bgcolor: 'grey.50',
                                        borderRadius: 2,
                                    }}
                                >
                                    <Typography variant="body2" sx={{
                                        color: "text.secondary"
                                    }}>
                                        {selectedNoteType.description}
                                    </Typography>
                                </Paper>
                            </Collapse>
                        </Box>
                    )}

                    {/* Public Note Warning */}
                    {isSelectedNoteTypePublic && (
                        <Alert
                            severity="info"
                            icon={<VisibilityIcon />}
                            sx={{mt: 1.5, borderRadius: 2}}
                        >
                            This is a public note that will be visible to clients
                        </Alert>
                    )}

                    {/* Courier Note Warning */}
                    {isSelectedNoteTypeCourierFacing && (
                        <Alert
                            severity="info"
                            icon={<LocalShippingIcon />}
                            sx={{mt: 1.5, borderRadius: 2}}
                        >
                            This is a courier note that will be visible to couriers
                        </Alert>
                    )}
                </Box>

                {/* Note Type Creator */}
                <Collapse in={showNoteTypeCreator}>
                    <Paper
                        variant="outlined"
                        sx={{
                            mb: 3,
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}
                    >
                        <Box sx={{p: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider'}}>
                            <Typography variant="subtitle1" sx={{
                                fontWeight: 600
                            }}>
                                Create New Note Type
                            </Typography>
                        </Box>
                        <Box sx={{p: 2}}>
                            <TextField
                                label="Note Type Name"
                                value={newNoteTypeName}
                                onChange={(e) => setNewNoteTypeName(e.target.value)}
                                fullWidth
                                size="small"
                                required
                                sx={{mb: 2}}
                            />
                            <TextField
                                label="Description (Optional)"
                                value={newNoteTypeDescription}
                                onChange={(e) => setNewNoteTypeDescription(e.target.value)}
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                                slotProps={{htmlInput: {maxLength: MAX_DESCRIPTION_LENGTH}}}
                                helperText={`${newNoteTypeDescription.length}/${MAX_DESCRIPTION_LENGTH}`}
                                placeholder="Provide a brief explanation of when to use this note type"
                                sx={{mb: 2}}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={newNoteTypeIsPublic}
                                        onChange={(e) => setNewNoteTypeIsPublic(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label="Is Public Note Type"
                            />
                            {newNoteTypeIsPublic && (
                                <Alert
                                    severity="warning"
                                    icon={<WarningIcon />}
                                    sx={{mt: 1, borderRadius: 2}}
                                >
                                    Public note types are visible to clients
                                </Alert>
                            )}
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={newNoteTypeIsCourierFacing}
                                        onChange={(e) => setNewNoteTypeIsCourierFacing(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label="Is Courier Facing Note Type"
                            />
                            {newNoteTypeIsCourierFacing && (
                                <Alert
                                    severity="warning"
                                    icon={<LocalShippingIcon />}
                                    sx={{mt: 1, borderRadius: 2}}
                                >
                                    Courier note types are visible to couriers
                                </Alert>
                            )}
                        </Box>
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: 'grey.50',
                                borderTop: 1,
                                borderColor: 'divider',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 1,
                            }}
                        >
                            <Button
                                onClick={() => {
                                    setShowNoteTypeCreator(false);
                                    resetNoteTypeForm();
                                }}
                                disabled={isCreatingNoteType}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleCreateNoteType}
                                disabled={!newNoteTypeName.trim() || isCreatingNoteType}
                                startIcon={isCreatingNoteType ? <CircularProgress size={18} color="inherit" /> : null}
                            >
                                Create Note Type
                            </Button>
                        </Box>
                    </Paper>
                </Collapse>

                {/* Note Content Section */}
                <Box sx={{mb: 3}}>
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5}}>
                        <Typography
                            variant="subtitle1"
                            sx={{fontWeight: 600}}>
                            Note Content
                        </Typography>
                        <AiDraftButton
                            onClick={handleDraftNote}
                            isDrafting={isDrafting}
                            disabled={noteTypeId <= 0}
                        />
                    </Box>
                    <TextField
                        label="Write your note"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        fullWidth
                        multiline
                        rows={5}
                        required
                        slotProps={{htmlInput: {maxLength: MAX_NOTE_LENGTH}}}
                        helperText={`${noteText.length}/${MAX_NOTE_LENGTH} characters`}
                        placeholder="Enter your note content here..."
                        sx={{mb: 2}}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isImportant}
                                onChange={(e) => setIsImportant(e.target.checked)}
                                color="warning"
                                icon={<PriorityHighIcon color="action" />}
                                checkedIcon={<PriorityHighIcon color="warning" />}
                            />
                        }
                        label={
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                Mark as Important
                            </Box>
                        }
                    />
                </Box>

                {/* Metadata Section for existing notes */}
                {!isNew && note && (
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2.5,
                            borderRadius: 2,
                            bgcolor: 'grey.50',
                        }}
                    >
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                            <InfoIcon fontSize="small" color="action" />
                            <Typography variant="subtitle2" sx={{
                                color: "text.secondary"
                            }}>
                                Note Information
                            </Typography>
                        </Box>

                        <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
                            {/* Created By */}
                            <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1.5}}>
                                <PersonIcon fontSize="small" color="action" sx={{mt: 0.25}} />
                                <Box>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: "text.secondary",
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5
                                        }}>
                                        Created by
                                    </Typography>
                                    <Typography variant="body2">
                                        {note.createdByName || 'System'}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Created Date */}
                            {note._createdDateStr && (
                                <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1.5}}>
                                    <ScheduleIcon fontSize="small" color="action" sx={{mt: 0.25}} />
                                    <Box>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: "text.secondary",
                                                textTransform: 'uppercase',
                                                letterSpacing: 0.5
                                            }}>
                                            Created on
                                        </Typography>
                                        <Typography variant="body2">
                                            {note._createdDateStr} {formattedTimeZone}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Updated Date */}
                            {note._updatedDateStr && (
                                <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1.5}}>
                                    <UpdateIcon fontSize="small" color="action" sx={{mt: 0.25}} />
                                    <Box>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: "text.secondary",
                                                textTransform: 'uppercase',
                                                letterSpacing: 0.5
                                            }}>
                                            Last updated
                                        </Typography>
                                        <Typography variant="body2">
                                            {note.updatedByName} on {note._updatedDateStr} {formattedTimeZone}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>

                        {/* Edit History */}
                        <NoteHistory
                            history={noteHistory}
                            isLoading={isLoadingHistory}
                            timeZoneAbbr={formattedTimeZone}
                        />
                    </Paper>
                )}
            </DialogContent>
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel="Save Note"
                confirmIcon={<SaveIcon />}
                confirmDisabled={!isFormValid}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default NoteManagementDialog;
