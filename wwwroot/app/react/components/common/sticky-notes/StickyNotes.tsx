/**
 * StickyNotes Component
 *
 * React functional component for displaying and managing job notes with a sticky note design.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {ActionIcon, Anchor, Box, Group, Loader, Menu, Paper, Progress, SimpleGrid, Stack, Text, Tooltip} from '@mantine/core';
import {CircleAlert, FilePlus, Folder, ListFilter, Shapes, StickyNote, Trash2} from 'lucide-react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '../../../query/queryClient';
import {StickyNotesProps} from './StickyNotes.interfaces';
import {JobNote, NoteType} from '../../../interfaces';
import {notesApi} from '../../../services/notesApi';
import {openNoteManagementDialog} from '../../dialogs/note-management-dialog/note-management-dialog-react.module';
import {cardContainerProps} from '../../common/job-details/JobDetails.styles';
import {SectionHeader} from '../job-details/components/SectionHeader';
import {Icon} from '../icon/Icon';
import classes from './StickyNotes.module.css';

/**
 * The sticky-note fills. Deliberately literal pastels rather than theme tokens:
 * they mimic physical note paper and carry the note's category, and the ink on
 * them is fixed dark regardless of colour scheme.
 */
const NOTE_FILLS = {
    important: '#ffccbc', // Orange for important
    internal: '#fff9c4',  // Yellow
    consignment: '#bbdefb', // Blue
    client: '#c8e6c9',    // Green
    default: '#e1f5fe',   // Light blue default
} as const;

/**
 * Get note type color based on type name and importance
 */
function getNoteTypeColor(noteTypeName?: string, isImportant?: boolean): string {
    if (isImportant) return NOTE_FILLS.important;

    const typeLower = noteTypeName?.toLowerCase() || '';
    switch (typeLower) {
        case 'internal':
            return NOTE_FILLS.internal;
        case 'consignment':
            return NOTE_FILLS.consignment;
        case 'client':
            return NOTE_FILLS.client;
        default:
            return NOTE_FILLS.default;
    }
}

/** Ink on the fixed pastel note paper, so these stay literal too. */
const noteInk = {
    heading: 'rgba(0,0,0,0.7)',
    body: 'rgba(0,0,0,0.8)',
    meta: 'rgba(0,0,0,0.54)',
    author: 'rgba(0,0,0,0.5)',
    glyph: 'rgba(0,0,0,0.6)',
};

// Mirrors backend Enums/NoteType.cs — keep in sync.
const PICKUP_NOTE_TYPE_ID = 9;
const DELIVERY_NOTE_TYPE_ID = 10;

// Pickup + delivery notes anchor to the bottom of the panel so they sit
// next to the address/journey area; everything else stays in date-desc order.
function getNoteOrderBucket(noteTypeId?: number): number {
    if (noteTypeId === DELIVERY_NOTE_TYPE_ID) return 2;
    if (noteTypeId === PICKUP_NOTE_TYPE_ID) return 1;
    return 0;
}

export const StickyNotes: React.FC<StickyNotesProps> = React.memo(({
    jobId,
    bulkJobId,
    isRecurringJob = false,
    showErrorToast,
    showSuccessToast,
}) => {
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Note types are global/static — cache indefinitely
    const noteCategoriesQuery = useQuery({
        queryKey: queryKeys.notes.types,
        queryFn: ({signal}) => notesApi.getNoteTypes({signal}),
        staleTime: Infinity,
    });

    // Job notes — fetched in parallel with parent job detail query
    const notesQuery = useQuery({
        queryKey: bulkJobId
            ? queryKeys.notes.bulkJob(bulkJobId)
            : queryKeys.notes.job(jobId ?? 0, isRecurringJob),
        queryFn: ({signal}) => {
            if (bulkJobId) return notesApi.getBulkJobNotes(bulkJobId, {signal});
            if (jobId) return notesApi.getJobNotes(jobId, isRecurringJob, {signal});
            return Promise.resolve([]);
        },
        enabled: !!(jobId || bulkJobId),
    });

    const notes = notesQuery.data ?? [];
    const noteCategories = noteCategoriesQuery.data ?? [];
    const loading = notesQuery.isLoading;
    const categoriesLoading = noteCategoriesQuery.isLoading;

    const filteredNotes = useMemo(() => {
        const base = selectedCategory === 'all'
            ? notes
            : notes.filter(note => note.noteTypeId === parseInt(selectedCategory));
        // Stable sort on a copy: preserves date-desc within each bucket.
        return [...base].sort(
            (a, b) => getNoteOrderBucket(a.noteTypeId) - getNoteOrderBucket(b.noteTypeId)
        );
    }, [notes, selectedCategory]);

    const isFilterActive = selectedCategory !== 'all';

    const invalidateNotes = useCallback(async () => {
        if (bulkJobId) {
            await queryClient.invalidateQueries({queryKey: queryKeys.notes.bulkJob(bulkJobId)});
        } else if (jobId) {
            await queryClient.invalidateQueries({queryKey: queryKeys.notes.job(jobId, isRecurringJob)});
        }
    }, [queryClient, jobId, bulkJobId, isRecurringJob]);

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

    const categoryNoteCounts = useMemo(() => {
        const counts = new Map<number, number>();
        for (const note of notes) {
            if (note.noteTypeId != null) {
                counts.set(note.noteTypeId, (counts.get(note.noteTypeId) ?? 0) + 1);
            }
        }
        return counts;
    }, [notes]);

    const handleFilterByCategory = (category: string | NoteType): void => {
        if (typeof category === 'string') {
            setSelectedCategory(category);
        } else {
            setSelectedCategory(category.id?.toString() || 'all');
        }
    };

    const handleAddNote = async (): Promise<void> => {
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
            await openNoteManagementDialog(emptyNote);
            await invalidateNotes();
        } catch (error) {
            // Dialog was canceled
            if (!error) return;
            console.error('Error adding note:', error);
        }
    };

    const handleEditNote = async (note: JobNote): Promise<void> => {
        try {
            await openNoteManagementDialog(note);
            await invalidateNotes();
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
            await notesApi.deleteNote(note.noteId ?? 0, note.jobId ?? (isRecurringJob ? undefined : jobId));
            await invalidateNotes();
            showSuccessToast?.('Note deleted successfully');
        } catch (error) {
            console.error('Error deleting note:', error);
            showErrorToast?.('Failed to delete note');
        }
    };

    const handleClearFilter = (): void => {
        setSelectedCategory('all');
    };

    /** A category row in the filter menu, with its note count. */
    const categoryItem = (key: React.Key, label: string, count: number, selected: boolean, onClick: () => void) => (
        <Menu.Item
            key={key}
            leftSection={<Icon lucide={Folder} size={18}/>}
            rightSection={<Text size="sm" c="dimmed">({count})</Text>}
            data-selected={selected || undefined}
            onClick={onClick}
        >
            {label}
        </Menu.Item>
    );

    return (
        <Paper {...cardContainerProps}>
            <SectionHeader
                lucide={StickyNote}
                title="Notes"
                subtitle={isFilterActive ? `- ${getCategoryName()}` : undefined}
                endAction={
                    <>
                        {/* Category filter */}
                        <Menu position="bottom-end">
                            <Menu.Target>
                                <Tooltip label="Filter by Category">
                                    <ActionIcon
                                        variant="subtle"
                                        size="sm"
                                        disabled={categoriesLoading}
                                        aria-label="Filter by category"
                                        style={{color: 'inherit'}}
                                    >
                                        {categoriesLoading
                                            ? <Loader size={16} color="currentColor"/>
                                            : <Icon lucide={isFilterActive ? ListFilter : Shapes} size={18}/>}
                                    </ActionIcon>
                                </Tooltip>
                            </Menu.Target>
                            <Menu.Dropdown>
                                {noteCategories.length === 0 ? (
                                    <Menu.Item disabled>No note categories available.</Menu.Item>
                                ) : ([
                                    categoryItem(
                                        'all',
                                        'All Categories',
                                        notes.length,
                                        selectedCategory === 'all',
                                        () => handleFilterByCategory('all'),
                                    ),
                                    <Menu.Divider key="divider"/>,
                                    ...noteCategories.map(category => categoryItem(
                                        category.id!,
                                        category.text ?? '',
                                        categoryNoteCounts.get(category.id!) ?? 0,
                                        selectedCategory === category.id?.toString(),
                                        () => handleFilterByCategory(category),
                                    )),
                                ])}
                            </Menu.Dropdown>
                        </Menu>
                        <Tooltip label="Add Note">
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={handleAddNote}
                                aria-label="Add note"
                                style={{color: 'inherit'}}
                            >
                                <Icon lucide={FilePlus} size={18}/>
                            </ActionIcon>
                        </Tooltip>
                    </>
                }
            />
            {/* Loading Indicator */}
            {loading && (
                <Progress.Root size={2} radius={0}>
                    <Progress.Section value={100} animated aria-label="Loading notes"/>
                </Progress.Root>
            )}
            {/* Notes Container */}
            {/*
              * Container-query columns, not viewport ones: this panel is docked at
              * whatever width job-detail gives it. 440px is where two 200px-min
              * notes plus the 16px gap stop fitting, which is the wrap point the
              * old `width: calc(50% - 8px)` + `minWidth: 200` pair produced.
              */}
            <SimpleGrid
                type="container"
                cols={{base: 1, '440px': 2}}
                spacing={16}
                p={16}
                style={{
                    backgroundColor: 'var(--mantine-color-body)',
                    minHeight: 120,
                    flex: 1,
                    overflow: 'auto',
                }}
            >
                {/* Notes */}
                {filteredNotes.map((note, index) => (
                    <Paper
                        key={note.noteId || index}
                        className={classes.note}
                        onClick={() => handleEditNote(note)}
                        shadow="xs"
                        style={{
                            padding: 16,
                            minHeight: 120,
                            cursor: 'pointer',
                            '--note-rotate': `${-1 + (index % 3)}deg`,
                            '--note-fill': getNoteTypeColor(note.noteTypeName, note.isImportant),
                        } as React.CSSProperties}
                    >
                        {/* Note Header */}
                        <Group justify="space-between" mb="xs" wrap="nowrap">
                            <Group gap={8} wrap="nowrap">
                                <Icon
                                    lucide={note.isImportant ? CircleAlert : StickyNote}
                                    size={20}
                                    color={noteInk.glyph}
                                    aria-hidden
                                />
                                <Text size="sm" fw={500} c={noteInk.heading}>
                                    {note.noteTypeName || 'Note'}
                                </Text>
                            </Group>
                            <Text size="xs" c={noteInk.meta}>{note._createdDateStr}</Text>
                        </Group>

                        {/* Note Content */}
                        <Text
                            size="sm"
                            c={noteInk.body}
                            style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5}}
                        >
                            {note.noteText}
                        </Text>

                        {/* Created By */}
                        {note.createdByName && (
                            <Text size="xs" mt="xs" fs="italic" c={noteInk.author} style={{display: 'block'}}>
                                - {note.createdByName}
                            </Text>
                        )}

                        {/* Delete Action */}
                        <Box className={classes.noteActions}>
                            <Tooltip label="Delete Note">
                                <ActionIcon
                                    variant="subtle"
                                    color="dark"
                                    size="sm"
                                    onClick={(e) => handleDeleteNote(e, note)}
                                    aria-label="Delete note"
                                >
                                    <Icon lucide={Trash2} size={20}/>
                                </ActionIcon>
                            </Tooltip>
                        </Box>
                    </Paper>
                ))}

                {/* Empty State */}
                {!loading && filteredNotes.length === 0 && (
                    <Stack
                        align="center"
                        justify="center"
                        gap={0}
                        mih={200}
                        // Spans every column so the empty state stays centred on the
                        // panel rather than sitting in the first grid cell.
                        style={{gridColumn: '1 / -1'}}
                    >
                        <Icon
                            lucide={StickyNote}
                            size={48}
                            color="var(--mantine-color-dimmed)"
                            style={{marginBottom: 8, opacity: 0.5}}
                            aria-hidden
                        />
                        <Text size="lg" c="dimmed" mb={4}>No Notes</Text>
                        <Text size="sm" c="dimmed" mb="md">{getNoNotesMessage()}</Text>
                        {isFilterActive && (
                            <Anchor
                                component="button"
                                type="button"
                                size="sm"
                                className={classes.clearFilter}
                                onClick={handleClearFilter}
                            >
                                Show all notes
                            </Anchor>
                        )}
                    </Stack>
                )}
            </SimpleGrid>
        </Paper>
    );
});

StickyNotes.displayName = 'StickyNotes';

export default StickyNotes;
