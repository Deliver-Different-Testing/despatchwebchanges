/**
 * React Note Management Dialog
 *
 * A dialog for creating and editing job notes with note type management.
 * Supports creating new note types inline and displays note metadata.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
    ActionIcon,
    Alert,
    Box,
    Button,
    Checkbox,
    Collapse,
    Group,
    Paper,
    Select,
    Stack,
    Text,
    Textarea,
    TextInput,
} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {
    ChevronDown,
    ChevronUp,
    CirclePlus,
    Clock,
    Eye,
    Info,
    NotebookPen,
    RefreshCw,
    Save,
    StickyNote,
    TriangleAlert,
    User,
} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';
import {DialogShell, DialogHeader, DialogFooter, dialogSize} from '../shared/mantine';
import {CreateNoteRequest, NoteType, UpdateNoteRequest} from '../../../interfaces';
import {getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {NoteManagementDialogProps} from "./types";
import {useNoteHistory} from '../../../hooks/useNotesApi';
import {NoteHistory} from './NoteHistory';
import {Icon} from '../../common/icon/Icon';
import {AiDraftButton} from '../../common/ai-draft-button/mantine/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {draftNote} from '../../../services/aiAssistantApi';

const MAX_NOTE_LENGTH = 1000;
const MAX_DESCRIPTION_LENGTH = 500;

const captionProps = {size: 'xs', c: 'dimmed', tt: 'uppercase', style: {letterSpacing: 0.5}} as const;

/** One icon + label + value row in the "Note Information" panel. */
function MetadataRow({icon, label, children}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}): React.ReactElement {
    return (
        <Group gap="sm" align="flex-start" wrap="nowrap">
            <Box c="dimmed" mt={2} style={{display: 'flex'}}>{icon}</Box>
            <Box>
                <Text {...captionProps}>{label}</Text>
                <Text size="sm">{children}</Text>
            </Box>
        </Group>
    );
}

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
    const [showNoteTypeCreator, {close: closeNoteTypeCreator, toggle: toggleNoteTypeCreator}] = useDisclosure(false);
    const [newNoteTypeName, setNewNoteTypeName] = useState('');
    const [newNoteTypeDescription, setNewNoteTypeDescription] = useState('');
    const [newNoteTypeIsPublic, setNewNoteTypeIsPublic] = useState(false);
    const [newNoteTypeIsCourierFacing, setNewNoteTypeIsCourierFacing] = useState(false);
    const [isCreatingNoteType, setIsCreatingNoteType] = useState(false);

    // Description toggle
    const [showDescription, {close: closeDescription, toggle: toggleDescription}] = useDisclosure(false);

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
            void loadNoteTypes();
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
            closeNoteTypeCreator();
            closeDescription();
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

            closeNoteTypeCreator();
            resetNoteTypeForm();
        } catch (error) {
            console.error('Error creating note type:', error);
            showToast('Failed to create note type', 'error');
        } finally {
            setIsCreatingNoteType(false);
        }
    };

    const isFormValid = noteText.trim() && noteTypeId > 0;

    const noteTypeOptions = noteTypes.map((type) => ({
        value: String(type.id),
        label: type.text ?? '',
    }));

    return (
        <DialogShell opened={open} onClose={onClose} size={dialogSize.md} label={title}>
            <DialogHeader
                icon={<Icon lucide={StickyNote}/>}
                title={title}
                subtitle={isNew ? 'Create a new note for this job' : 'Update an existing note'}
                onClose={onClose}
            />
            <Box p="lg">
                {/* Note Type Section */}
                <Box mb="lg">
                    <Group justify="space-between" mb="sm" wrap="nowrap">
                        <Text fw={600}>Note Type</Text>
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="Add note type"
                            onClick={toggleNoteTypeCreator}
                        >
                            <Icon lucide={CirclePlus}/>
                        </ActionIcon>
                    </Group>

                    <Select
                        label="Select Note Type"
                        data={noteTypeOptions}
                        value={noteTypeId ? String(noteTypeId) : null}
                        onChange={(value) => setNoteTypeId(Number(value) || 0)}
                        disabled={isLoadingTypes}
                        size="sm"
                        leftSection={<Icon lucide={NotebookPen} size={16}/>}
                    />

                    {/* Note Type Description */}
                    {selectedNoteType?.description && (
                        <Box mt="sm">
                            <Button
                                variant="subtle"
                                color="gray"
                                size="compact-sm"
                                onClick={toggleDescription}
                                leftSection={<Icon lucide={showDescription ? ChevronUp : ChevronDown} size={16}/>}
                            >
                                View Description
                            </Button>
                            <Collapse expanded={showDescription} keepMounted={false}>
                                <Paper withBorder radius="md" mt="xs" p="md" bg="var(--mantine-color-gray-0)">
                                    <Text size="sm" c="dimmed">{selectedNoteType.description}</Text>
                                </Paper>
                            </Collapse>
                        </Box>
                    )}

                    {/* Public Note Warning */}
                    {isSelectedNoteTypePublic && (
                        <Alert color="reflex" icon={<Icon lucide={Eye}/>} mt="sm" radius="md">
                            This is a public note that will be visible to clients
                        </Alert>
                    )}

                    {/* Courier Note Warning */}
                    {isSelectedNoteTypeCourierFacing && (
                        <Alert color="reflex" icon={<Icon tabler={IconTruck}/>} mt="sm" radius="md">
                            This is a courier note that will be visible to couriers
                        </Alert>
                    )}
                </Box>

                {/* Note Type Creator */}
                <Collapse expanded={showNoteTypeCreator} keepMounted={false}>
                    <Paper withBorder radius="md" mb="lg" style={{overflow: 'hidden'}}>
                        <Box
                            p="md"
                            style={{
                                backgroundColor: 'var(--mantine-color-gray-0)',
                                borderBottom: '1px solid var(--mantine-color-default-border)',
                            }}
                        >
                            <Text fw={600}>Create New Note Type</Text>
                        </Box>
                        <Stack p="md" gap="md">
                            <TextInput
                                label="Note Type Name"
                                value={newNoteTypeName}
                                onChange={(e) => setNewNoteTypeName(e.currentTarget.value)}
                                size="sm"
                                required
                            />
                            <Textarea
                                label="Description (Optional)"
                                value={newNoteTypeDescription}
                                onChange={(e) => setNewNoteTypeDescription(e.currentTarget.value)}
                                size="sm"
                                rows={2}
                                maxLength={MAX_DESCRIPTION_LENGTH}
                                description={`${newNoteTypeDescription.length}/${MAX_DESCRIPTION_LENGTH}`}
                                placeholder="Provide a brief explanation of when to use this note type"
                            />
                            <Box>
                                <Checkbox
                                    checked={newNoteTypeIsPublic}
                                    onChange={(e) => setNewNoteTypeIsPublic(e.currentTarget.checked)}
                                    label="Is Public Note Type"
                                />
                                {newNoteTypeIsPublic && (
                                    <Alert color="orange" icon={<Icon lucide={TriangleAlert}/>} mt="xs" radius="md">
                                        Public note types are visible to clients
                                    </Alert>
                                )}
                            </Box>
                            <Box>
                                <Checkbox
                                    checked={newNoteTypeIsCourierFacing}
                                    onChange={(e) => setNewNoteTypeIsCourierFacing(e.currentTarget.checked)}
                                    label="Is Courier Facing Note Type"
                                />
                                {newNoteTypeIsCourierFacing && (
                                    <Alert color="orange" icon={<Icon tabler={IconTruck}/>} mt="xs" radius="md">
                                        Courier note types are visible to couriers
                                    </Alert>
                                )}
                            </Box>
                        </Stack>
                        <Group
                            justify="flex-end"
                            gap="xs"
                            p="md"
                            style={{
                                backgroundColor: 'var(--mantine-color-gray-0)',
                                borderTop: '1px solid var(--mantine-color-default-border)',
                            }}
                        >
                            <Button
                                variant="subtle"
                                color="gray"
                                onClick={() => {
                                    closeNoteTypeCreator();
                                    resetNoteTypeForm();
                                }}
                                disabled={isCreatingNoteType}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateNoteType}
                                disabled={!newNoteTypeName.trim()}
                                loading={isCreatingNoteType}
                            >
                                Create Note Type
                            </Button>
                        </Group>
                    </Paper>
                </Collapse>

                {/* Note Content Section */}
                <Box mb="lg">
                    <Group justify="space-between" mb="sm" wrap="nowrap">
                        <Text fw={600}>Note Content</Text>
                        <AiDraftButton
                            category="writing"
                            onClick={handleDraftNote}
                            isDrafting={isDrafting}
                            disabled={noteTypeId <= 0}
                        />
                    </Group>
                    <Textarea
                        label="Write your note"
                        value={noteText}
                        onChange={(e) => setNoteText(e.currentTarget.value)}
                        rows={5}
                        required
                        maxLength={MAX_NOTE_LENGTH}
                        description={`${noteText.length}/${MAX_NOTE_LENGTH} characters`}
                        placeholder="Enter your note content here..."
                        mb="md"
                    />
                    <Checkbox
                        checked={isImportant}
                        onChange={(e) => setIsImportant(e.currentTarget.checked)}
                        color="orange"
                        label="Mark as Important"
                    />
                </Box>

                {/* Metadata Section for existing notes */}
                {!isNew && note && (
                    <Paper withBorder radius="md" p="md" bg="var(--mantine-color-gray-0)">
                        <Group gap="xs" mb="md" wrap="nowrap">
                            <Box c="dimmed" style={{display: 'flex'}}>
                                <Icon lucide={Info} size={16}/>
                            </Box>
                            <Text size="sm" c="dimmed" fw={500}>Note Information</Text>
                        </Group>

                        <Stack gap="sm">
                            <MetadataRow icon={<Icon lucide={User} size={16}/>} label="Created by">
                                {note.createdByName || 'System'}
                            </MetadataRow>

                            {note._createdDateStr && (
                                <MetadataRow icon={<Icon lucide={Clock} size={16}/>} label="Created on">
                                    {note._createdDateStr} {formattedTimeZone}
                                </MetadataRow>
                            )}

                            {note._updatedDateStr && (
                                <MetadataRow icon={<Icon lucide={RefreshCw} size={16}/>} label="Last updated">
                                    {note.updatedByName} on {note._updatedDateStr} {formattedTimeZone}
                                </MetadataRow>
                            )}
                        </Stack>

                        {/* Edit History */}
                        <NoteHistory
                            history={noteHistory}
                            isLoading={isLoadingHistory}
                            timeZoneAbbr={formattedTimeZone}
                        />
                    </Paper>
                )}
            </Box>
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel="Save Note"
                confirmIcon={<Icon lucide={Save}/>}
                confirmDisabled={!isFormValid}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default NoteManagementDialog;
