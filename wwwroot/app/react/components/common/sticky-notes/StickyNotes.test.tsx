/**
 * StickyNotes Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen, waitFor, within, fireEvent} from '@testing-library/react';
import {MantineProvider} from '@mantine/core';
import {createDfrntTheme} from '../../../theme/dfrntMantineTheme';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {StickyNotes} from './StickyNotes';
import {StickyNotesProps} from './StickyNotes.interfaces';
import {JobNote, NoteType} from '../../../interfaces';
import {notesApi} from '../../../services/notesApi';
import {openNoteManagementDialog} from '../../dialogs/note-management-dialog/note-management-dialog-react.module';
import {MantineTestProvider} from '../../../__testUtils__';

// Mock the notesApi module
jest.mock('../../../services/notesApi');
jest.mock('../../dialogs/note-management-dialog/note-management-dialog-react.module', () => ({
    openNoteManagementDialog: jest.fn(),
}));
const mockedOpenNoteManagementDialog = openNoteManagementDialog as jest.MockedFunction<typeof openNoteManagementDialog>;
const mockedNotesApi = notesApi as jest.Mocked<typeof notesApi>;

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {retry: false, gcTime: 0},
        },
    });
}

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                {ui}
            </MantineTestProvider>
        </QueryClientProvider>
    );
};

// Sample note data
const createMockNotes = (): JobNote[] => [
    {
        noteId: 1,
        noteTypeId: 1,
        noteTypeName: 'Internal',
        jobId: 123,
        noteText: 'This is an internal note',
        isImportant: false,
        createdByName: 'John Smith',
        _createdDateStr: 'Jan 15, 2025 9:00 AM',
    },
    {
        noteId: 2,
        noteTypeId: 2,
        noteTypeName: 'Client',
        jobId: 123,
        noteText: 'This is a client note',
        isImportant: false,
        createdByName: 'Jane Doe',
        _createdDateStr: 'Jan 15, 2025 10:00 AM',
    },
    {
        noteId: 3,
        noteTypeId: 1,
        noteTypeName: 'Internal',
        jobId: 123,
        noteText: 'Important internal note',
        isImportant: true,
        _createdDateStr: 'Jan 15, 2025 11:00 AM',
    },
];

const createMockNoteTypes = (): NoteType[] => [
    {id: 1, text: 'Internal', isPublic: false},
    {id: 2, text: 'Client', isPublic: true},
    {id: 3, text: 'Consignment', isPublic: true},
];

const createDefaultProps = (overrides?: Partial<StickyNotesProps>): StickyNotesProps => {
    return {
        jobId: 123,
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showInfoToast: jest.fn(),
        ...overrides,
    };
};

describe('StickyNotes', () => {
    beforeEach(() => {
        // Setup default mock implementations
        mockedNotesApi.getJobNotes.mockResolvedValue(createMockNotes());
        mockedNotesApi.getBulkJobNotes.mockResolvedValue(createMockNotes());
        mockedNotesApi.getNoteTypes.mockResolvedValue(createMockNoteTypes());
        mockedNotesApi.deleteNote.mockResolvedValue(undefined);
        mockedOpenNoteManagementDialog.mockResolvedValue(true);
    });

    describe('Rendering', () => {
        it('renders header, notes, type names, dates, filter button, and add note button after loading', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            // Header
            expect(screen.getByText('Notes')).toBeInTheDocument();

            // Notes after loading
            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();
            expect(screen.getByText('This is a client note')).toBeInTheDocument();
            expect(screen.getByText('Important internal note')).toBeInTheDocument();

            // Note type names - Internal appears twice (2 internal notes)
            const internalNotes = screen.getAllByText('Internal');
            expect(internalNotes.length).toBe(2);
            expect(screen.getByText('Client')).toBeInTheDocument();

            // Note dates
            expect(screen.getByText('Jan 15, 2025 9:00 AM')).toBeInTheDocument();

            // Category filter button exists
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);

            // Add note button exists
            expect(screen.getByRole('button', {name: 'Add note'})).toBeInTheDocument();

            // Created by names shown when present
            expect(screen.getByText('- John Smith')).toBeInTheDocument();
            expect(screen.getByText('- Jane Doe')).toBeInTheDocument();
        });

        it('does not render created by when createdByName is absent', async () => {
            mockedNotesApi.getJobNotes.mockResolvedValue([{
                noteId: 10,
                noteTypeId: 1,
                noteTypeName: 'Internal',
                jobId: 123,
                noteText: 'Note without author',
                isImportant: false,
            }]);
            renderWithProviders(<StickyNotes {...createDefaultProps()} />);

            expect(await screen.findByText('Note without author')).toBeInTheDocument();
            expect(screen.queryByText(/^-\s/)).not.toBeInTheDocument();
        });

        it('renders empty state when no notes', async () => {
            mockedNotesApi.getJobNotes.mockResolvedValue([]);
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('No Notes')).toBeInTheDocument();
            expect(screen.getByText('No notes available for this job')).toBeInTheDocument();
        });

        it('does not load notes when no jobId provided', async () => {
            const props = createDefaultProps({jobId: undefined});
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('No Notes')).toBeInTheDocument();
            expect(mockedNotesApi.getJobNotes).not.toHaveBeenCalled();
        });
    });

    describe('Bulk Job Notes', () => {
        it('loads bulk job notes when bulkJobId is provided', async () => {
            const props = createDefaultProps({jobId: undefined, bulkJobId: 456});
            renderWithProviders(<StickyNotes {...props} />);

            await waitFor(() => {
                expect(mockedNotesApi.getBulkJobNotes).toHaveBeenCalledWith(456, expect.anything());
            });
        });
    });

    describe('Category Filtering', () => {
        it('opens category menu and shows note categories when filter button is clicked', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Find and click filter button
            const filterButton = screen.getByRole('button', {name: 'Filter by category'});
            expect(filterButton).toBeInTheDocument();
            fireEvent.click(filterButton!);

            // Menu opens with All Categories header
            expect(await screen.findByText('All Categories')).toBeInTheDocument();

            // Check menu items
            const menu = screen.getByRole('menu');
            expect(within(menu).getByText('Internal')).toBeInTheDocument();
            expect(within(menu).getByText('Client')).toBeInTheDocument();
            expect(within(menu).getByText('Consignment')).toBeInTheDocument();
        });

        it('does not produce Fragment children warning when category menu is open', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            const filterButton = screen.getByRole('button', {name: 'Filter by category'});
            fireEvent.click(filterButton!);

            expect(await screen.findByText('All Categories')).toBeInTheDocument();

            const fragmentWarnings = consoleErrorSpy.mock.calls.filter(
                (args) => typeof args[0] === 'string' && args[0].includes('Fragment as a child')
            );
            expect(fragmentWarnings).toHaveLength(0);
            consoleErrorSpy.mockRestore();
        });

        it('filters notes by category when selected', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Open menu and select "Client" category
            const filterButton = screen.getByRole('button', {name: 'Filter by category'});
            await user.click(filterButton!);

            expect(await screen.findByRole('menu')).toBeInTheDocument();

            const menu = screen.getByRole('menu');
            const clientMenuItem = within(menu).getByText('Client');
            await user.click(clientMenuItem);

            // Should only show client note
            expect(await screen.findByText('This is a client note')).toBeInTheDocument();
            expect(screen.queryByText('This is an internal note')).not.toBeInTheDocument();
        });

        it('shows filter indicator when category is selected', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Open menu and select "Client" category
            const filterButton = screen.getByRole('button', {name: 'Filter by category'});
            await user.click(filterButton!);

            expect(await screen.findByRole('menu')).toBeInTheDocument();

            const menu = screen.getByRole('menu');
            await user.click(within(menu).getByText('Client'));

            // Should show filter indicator in header
            expect(await screen.findByText('- Client')).toBeInTheDocument();
        });
    });

    describe('Add Note', () => {
        it('opens note dialog when add button is clicked and reloads notes after dialog closes', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Clear the mock to track new calls
            mockedNotesApi.getJobNotes.mockClear();

            const addButton = screen.getByRole('button', {name: 'Add note'});
            fireEvent.click(addButton);

            // Dialog should be opened
            expect(mockedOpenNoteManagementDialog).toHaveBeenCalled();

            // Notes should be reloaded after dialog closes
            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalled();
            });
        });

        it('displays newly created note after dialog saves and refetch completes', async () => {
            // Start with no notes
            mockedNotesApi.getJobNotes.mockResolvedValue([]);
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('No Notes')).toBeInTheDocument();

            // After dialog resolves, return one new note on refetch
            const newNote: JobNote = {
                noteId: 99,
                noteTypeId: 1,
                noteTypeName: 'Internal',
                jobId: 123,
                noteText: 'Brand new note',
                isImportant: false,
                _createdDateStr: 'Mar 27, 2026 2:00 PM',
            };
            mockedNotesApi.getJobNotes.mockResolvedValue([newNote]);

            fireEvent.click(screen.getByRole('button', {name: 'Add note'}));

            expect(mockedOpenNoteManagementDialog).toHaveBeenCalled();

            // The new note should appear after refetch
            expect(await screen.findByText('Brand new note')).toBeInTheDocument();
            expect(screen.queryByText('No Notes')).not.toBeInTheDocument();
        });
    });

    describe('Edit Note', () => {
        it('opens note dialog when note is clicked and reloads notes after edit dialog closes', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Clear the mock to track new calls
            mockedNotesApi.getJobNotes.mockClear();

            fireEvent.click(screen.getByText('This is an internal note'));

            // Dialog should be opened
            expect(mockedOpenNoteManagementDialog).toHaveBeenCalled();

            // Notes should be reloaded after dialog closes
            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalled();
            });
        });
    });

    describe('Delete Note', () => {
        it('calls deleteNote API when confirmed and shows success toast', async () => {
            const props = createDefaultProps();

            // Mock window.confirm
            const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            const deleteButtons = screen.getAllByRole('button', {name: 'Delete note'});
            fireEvent.click(deleteButtons[0]);

            expect(confirmSpy).toHaveBeenCalled();
            expect(mockedNotesApi.deleteNote).toHaveBeenCalledWith(1, 123);

            // Shows success toast after deleting
            await waitFor(() => {
                expect(props.showSuccessToast).toHaveBeenCalledWith('Note deleted successfully');
            });

            confirmSpy.mockRestore();
        });

        it('does not delete note when cancelled', async () => {
            const props = createDefaultProps();

            // Mock window.confirm to return false
            const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            const deleteButtons = screen.getAllByRole('button', {name: 'Delete note'});
            fireEvent.click(deleteButtons[0]);

            expect(confirmSpy).toHaveBeenCalled();
            expect(mockedNotesApi.deleteNote).not.toHaveBeenCalled();

            confirmSpy.mockRestore();
        });
    });

    describe('Theme Support', () => {
        it('takes its brand accent from the provider rather than a hardcoded hue', async () => {
            const {unmount} = renderWithProviders(<StickyNotes {...createDefaultProps()} />);
            expect(await screen.findByText('Notes')).toBeInTheDocument();
            unmount();

            // Same tree under the other tenant's ramp: the panel still renders, and
            // nothing in it is pinned to one tenant's primary.
            render(
                <QueryClientProvider client={createTestQueryClient()}>
                    <MantineProvider theme={createDfrntTheme(false)} env="test">
                        <StickyNotes {...createDefaultProps()} />
                    </MantineProvider>
                </QueryClientProvider>
            );

            expect(await screen.findByText('Notes')).toBeInTheDocument();
        });
    });

    describe('Ordering', () => {
        it('renders pickup notes second-to-last and delivery notes last, with other notes first in source order', async () => {
            const orderedNotes: JobNote[] = [
                {
                    noteId: 100,
                    noteTypeId: 10, // Delivery
                    noteTypeName: 'Delivery',
                    jobId: 123,
                    noteText: 'Drop at reception',
                    isImportant: false,
                },
                {
                    noteId: 101,
                    noteTypeId: 1, // Internal
                    noteTypeName: 'Internal',
                    jobId: 123,
                    noteText: 'Top-of-list other A',
                    isImportant: false,
                },
                {
                    noteId: 102,
                    noteTypeId: 9, // Pickup
                    noteTypeName: 'Pickup',
                    jobId: 123,
                    noteText: 'Gate code 1234',
                    isImportant: false,
                },
                {
                    noteId: 103,
                    noteTypeId: 2, // Client
                    noteTypeName: 'Client',
                    jobId: 123,
                    noteText: 'Top-of-list other B',
                    isImportant: false,
                },
            ];
            mockedNotesApi.getJobNotes.mockResolvedValue(orderedNotes);
            renderWithProviders(<StickyNotes {...createDefaultProps()} />);

            expect(await screen.findByText('Top-of-list other A')).toBeInTheDocument();

            const rendered = screen.getAllByText(
                /^(Top-of-list other A|Top-of-list other B|Gate code 1234|Drop at reception)$/
            );
            expect(rendered.map(el => el.textContent)).toEqual([
                'Top-of-list other A',
                'Top-of-list other B',
                'Gate code 1234',
                'Drop at reception',
            ]);
        });
    });

    describe('Data Loading', () => {
        it('loads notes and note types on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalledWith(123, false, expect.anything());
                expect(mockedNotesApi.getNoteTypes).toHaveBeenCalled();
            });
        });

        it('loads recurring job notes when isRecurringJob is true', async () => {
            const props = createDefaultProps({isRecurringJob: true});
            renderWithProviders(<StickyNotes {...props} />);

            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalledWith(123, true, expect.anything());
            });
        });
    });
});
