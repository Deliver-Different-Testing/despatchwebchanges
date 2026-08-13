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

// Mirrors backend Enums/NoteType.cs — keep in sync.
const INTERNAL_NOTE_TYPE_ID = 1;
const CLIENT_NOTE_TYPE_ID = 2;
const FLIGHT_UPDATE_NOTE_TYPE_ID = 3;
const AGENT_UPDATE_NOTE_TYPE_ID = 4;
const CONSIGNMENT_NOTE_TYPE_ID = 5;
const PICKUP_NOTE_TYPE_ID = 9;
const DELIVERY_NOTE_TYPE_ID = 10;
const PRICING_UPDATE_NOTE_TYPE_ID = 1100;
const ADDRESS_UPDATE_NOTE_TYPE_ID = 1101;

/**
 * The sticky-note fills. Deliberately literal pastels rather than theme tokens:
 * they mimic physical note paper and carry the note's category, and the ink on
 * them is fixed dark regardless of colour scheme. All sit in the same luminance
 * band so `noteInk` stays legible on every one of them.
 */
export const NOTE_FILLS = {
    important: '#ffccbc', // Orange for important
    internal: '#fff9c4',  // Yellow
    consignment: '#bbdefb', // Blue
    client: '#c8e6c9',    // Green
    flightUpdate: '#d1c4e9', // Lavender
    agentUpdate: '#ffe0b2',  // Peach
    pickup: '#b2dfdb',       // Mint
    delivery: '#b2ebf2',     // Pale cyan
    pricingUpdate: '#f8bbd0', // Pale pink
    addressUpdate: '#eceff1', // Pale grey
    default: '#e1f5fe',   // Light blue default
} as const;

const FILL_BY_TYPE_ID: Record<number, string> = {
    [INTERNAL_NOTE_TYPE_ID]: NOTE_FILLS.internal,
    [CLIENT_NOTE_TYPE_ID]: NOTE_FILLS.client,
    [FLIGHT_UPDATE_NOTE_TYPE_ID]: NOTE_FILLS.flightUpdate,
    [AGENT_UPDATE_NOTE_TYPE_ID]: NOTE_FILLS.agentUpdate,
    [CONSIGNMENT_NOTE_TYPE_ID]: NOTE_FILLS.consignment,
    [PICKUP_NOTE_TYPE_ID]: NOTE_FILLS.pickup,
    [DELIVERY_NOTE_TYPE_ID]: NOTE_FILLS.delivery,
    [PRICING_UPDATE_NOTE_TYPE_ID]: NOTE_FILLS.pricingUpdate,
    [ADDRESS_UPDATE_NOTE_TYPE_ID]: NOTE_FILLS.addressUpdate,
};

// Tenants can add their own note types, which get ids outside the canonical enum,
// so a type whose id we don't know still gets its colour from a word in its name.
const FILL_BY_NAME_WORD: ReadonlyArray<readonly [string, string]> = [
    ['internal', NOTE_FILLS.internal],
    ['client', NOTE_FILLS.client],
    ['consignment', NOTE_FILLS.consignment],
    ['flight', NOTE_FILLS.flightUpdate],
    ['agent', NOTE_FILLS.agentUpdate],
    ['pickup', NOTE_FILLS.pickup],
    ['delivery', NOTE_FILLS.delivery],
    ['pricing', NOTE_FILLS.pricingUpdate],
    ['address', NOTE_FILLS.addressUpdate],
];

/** The paper colour for a note: importance first, then its type, then the default. */
export function getNoteFill(note: JobNote): string {
    if (note.isImportant) return NOTE_FILLS.important;

    const byId = FILL_BY_TYPE_ID[note.noteTypeId];
    if (byId) return byId;

    const words = new Set((note.noteTypeName ?? '').toLowerCase().split(/\s+/));
    return FILL_BY_NAME_WORD.find(([word]) => words.has(word))?.[1] ?? NOTE_FILLS.default;
}

/** Ink on the fixed pastel note paper, so these stay literal too. */
const noteInk = {
    heading: 'rgba(0,0,0,0.7)',
    body: 'rgba(0,0,0,0.8)',
    // 0.62 rather than 0.54: this is xs text, and the lighter alpha fell short of
    // the 4.5:1 contrast floor on the paler fills.
    meta: 'rgba(0,0,0,0.62)',
    author: 'rgba(0,0,0,0.5)',
    glyph: 'rgba(0,0,0,0.6)',
};

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
                            '--note-fill': getNoteFill(note),
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
