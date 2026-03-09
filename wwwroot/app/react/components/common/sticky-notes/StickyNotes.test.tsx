/**
 * StickyNotes Component Tests
 */

import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material';
import {StickyNotes} from './StickyNotes';
import {StickyNotesProps} from './StickyNotes.interfaces';
import {JobNote, NoteType} from '../../../interfaces';
import {notesApi} from '../../../services/notesApi';

// Mock the notesApi module
jest.mock('../../../services/notesApi');
const mockedNotesApi = notesApi as jest.Mocked<typeof notesApi>;

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
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
        _createdDateStr: 'Jan 15, 2025 9:00 AM',
    },
    {
        noteId: 2,
        noteTypeId: 2,
        noteTypeName: 'Client',
        jobId: 123,
        noteText: 'This is a client note',
        isImportant: false,
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

const createMockDialogService = () => ({
    openNoteDialog: jest.fn().mockResolvedValue(undefined),
});

const createDefaultProps = (overrides?: Partial<StickyNotesProps>): StickyNotesProps => {
    return {
        jobId: 123,
        noteManagementDialogService: createMockDialogService(),
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showInfoToast: jest.fn(),
        isUsCustomer: true,
        ...overrides,
    };
};

describe('StickyNotes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default mock implementations
        mockedNotesApi.getJobNotes.mockResolvedValue(createMockNotes());
        mockedNotesApi.getBulkJobNotes.mockResolvedValue(createMockNotes());
        mockedNotesApi.getNoteTypes.mockResolvedValue(createMockNoteTypes());
        mockedNotesApi.deleteNote.mockResolvedValue(undefined);
    });

    describe('Rendering', () => {
        it('renders notes header', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(screen.getByText('Notes')).toBeInTheDocument();
        });

        it('renders notes after loading', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            expect(screen.getByText('This is a client note')).toBeInTheDocument();
            expect(screen.getByText('Important internal note')).toBeInTheDocument();
        });

        it('renders note type names', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Internal appears twice (2 internal notes)
            const internalNotes = screen.getAllByText('Internal');
            expect(internalNotes.length).toBe(2);
            expect(screen.getByText('Client')).toBeInTheDocument();
        });

        it('renders note dates', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            expect(screen.getByText('Jan 15, 2025 9:00 AM')).toBeInTheDocument();
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
                expect(mockedNotesApi.getBulkJobNotes).toHaveBeenCalledWith(456);
            });
        });
    });

    describe('Category Filtering', () => {
        it('renders category filter button', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Find the filter button by looking for the category icon
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('opens category menu when filter button is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Find button containing category icon
            const categoryIcon = screen.getByText('category');
            const filterButton = categoryIcon.closest('button');
            expect(filterButton).toBeInTheDocument();
            await user.click(filterButton!);

            expect(await screen.findByText('All Categories')).toBeInTheDocument();
        });

        it('shows note categories in menu', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            const categoryIcon = screen.getByText('category');
            const filterButton = categoryIcon.closest('button');
            await user.click(filterButton!);

            await waitFor(() => {
                // Check menu items - note: "Internal" also appears in notes, so we check menu specifically
                const menu = screen.getByRole('menu');
                expect(within(menu).getByText('Internal')).toBeInTheDocument();
                expect(within(menu).getByText('Client')).toBeInTheDocument();
                expect(within(menu).getByText('Consignment')).toBeInTheDocument();
            });
        });

        it('filters notes by category when selected', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Open menu and select "Client" category
            const categoryIcon = screen.getByText('category');
            const filterButton = categoryIcon.closest('button');
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
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Open menu and select "Client" category
            const categoryIcon = screen.getByText('category');
            const filterButton = categoryIcon.closest('button');
            await user.click(filterButton!);

            expect(await screen.findByRole('menu')).toBeInTheDocument();

            const menu = screen.getByRole('menu');
            await user.click(within(menu).getByText('Client'));

            // Should show filter indicator in header
            expect(await screen.findByText('- Client')).toBeInTheDocument();
        });
    });

    describe('Add Note', () => {
        it('renders add note button', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Find the add note button by its icon
            const addIcon = screen.getByText('note_add');
            expect(addIcon).toBeInTheDocument();
        });

        it('opens note dialog when add button is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            const addIcon = screen.getByText('note_add');
            const addButton = addIcon.closest('button');
            await user.click(addButton!);

            expect(props.noteManagementDialogService.openNoteDialog).toHaveBeenCalled();
        });

        it('reloads notes after dialog closes', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Clear the mock to track new calls
            mockedNotesApi.getJobNotes.mockClear();

            const addIcon = screen.getByText('note_add');
            const addButton = addIcon.closest('button');
            await user.click(addButton!);

            // Notes should be reloaded after dialog closes
            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalled();
            });
        });
    });

    describe('Edit Note', () => {
        it('opens note dialog when note is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            await user.click(screen.getByText('This is an internal note'));

            expect(props.noteManagementDialogService.openNoteDialog).toHaveBeenCalled();
        });

        it('reloads notes after edit dialog closes', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Clear the mock to track new calls
            mockedNotesApi.getJobNotes.mockClear();

            await user.click(screen.getByText('This is an internal note'));

            // Notes should be reloaded after dialog closes
            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalled();
            });
        });
    });

    describe('Delete Note', () => {
        it('calls deleteNote API when confirmed', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();

            // Mock window.confirm
            const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            // Find delete buttons by icon text
            const deleteIcons = screen.getAllByText('delete');
            const deleteButton = deleteIcons[0].closest('button');
            await user.click(deleteButton!);

            expect(confirmSpy).toHaveBeenCalled();
            expect(mockedNotesApi.deleteNote).toHaveBeenCalledWith(1);

            confirmSpy.mockRestore();
        });

        it('does not delete note when cancelled', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();

            // Mock window.confirm to return false
            const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            const deleteIcons = screen.getAllByText('delete');
            const deleteButton = deleteIcons[0].closest('button');
            await user.click(deleteButton!);

            expect(confirmSpy).toHaveBeenCalled();
            expect(mockedNotesApi.deleteNote).not.toHaveBeenCalled();

            confirmSpy.mockRestore();
        });

        it('shows success toast after deleting note', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();

            const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('This is an internal note')).toBeInTheDocument();

            const deleteIcons = screen.getAllByText('delete');
            const deleteButton = deleteIcons[0].closest('button');
            await user.click(deleteButton!);

            await waitFor(() => {
                expect(props.showSuccessToast).toHaveBeenCalledWith('Note deleted successfully');
            });

            confirmSpy.mockRestore();
        });
    });

    describe('Theme Support', () => {
        it('renders with US theme when isUsCustomer is true', async () => {
            const props = createDefaultProps({isUsCustomer: true});
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('Notes')).toBeInTheDocument();
        });

        it('renders with NZ theme when isUsCustomer is false', async () => {
            const props = createDefaultProps({isUsCustomer: false});
            renderWithProviders(<StickyNotes {...props} />);

            expect(await screen.findByText('Notes')).toBeInTheDocument();
        });
    });

    describe('Data Loading', () => {
        it('loads notes on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalledWith(123, false);
            });
        });

        it('loads recurring job notes when isRecurringJob is true', async () => {
            const props = createDefaultProps({isRecurringJob: true});
            renderWithProviders(<StickyNotes {...props} />);

            await waitFor(() => {
                expect(mockedNotesApi.getJobNotes).toHaveBeenCalledWith(123, true);
            });
        });

        it('loads note types on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<StickyNotes {...props} />);

            await waitFor(() => {
                expect(mockedNotesApi.getNoteTypes).toHaveBeenCalled();
            });
        });
    });
});
