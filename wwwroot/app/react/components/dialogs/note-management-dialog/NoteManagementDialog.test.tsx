/**
 * NoteManagementDialog Component Tests
 */

import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material';
import {NoteManagementDialog} from './NoteManagementDialog';
import {NoteManagementDialogProps} from './types';
import {JobNote, NoteType} from '../../../interfaces/notes';

// Mock the dateUtils module
jest.mock('../../../utils/dateUtils', () => ({
    getTimezoneAbbreviation: jest.fn(() => '(PST)'),
}));

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const mockNoteTypes: NoteType[] = [
    {id: 1, text: 'General', isPublic: false, description: 'General notes'},
    {id: 2, text: 'Customer', isPublic: true, description: 'Customer-visible notes'},
    {id: 3, text: 'Internal', isPublic: false},
];

const mockNote: JobNote = {
    noteId: 123,
    noteTypeId: 1,
    noteTypeName: 'General',
    noteText: 'This is an existing note',
    isImportant: false,
    jobId: 456,
    createdByName: 'John Doe',
    _createdDateStr: 'Jan 15, 2024 2:30 PM',
    updatedByName: 'Jane Smith',
    _updatedDateStr: 'Jan 16, 2024 10:00 AM',
};

const createMockProps = (overrides: Partial<NoteManagementDialogProps> = {}): NoteManagementDialogProps => ({
    open: true,
    note: null,
    onClose: jest.fn(),
    onSave: jest.fn(),
    onLoadNoteTypes: jest.fn().mockResolvedValue(mockNoteTypes),
    onCreateNote: jest.fn().mockResolvedValue({noteId: 1, noteText: 'Test'}),
    onUpdateNote: jest.fn().mockResolvedValue(undefined),
    onCreateNoteType: jest.fn().mockResolvedValue({id: 4, text: 'New Type', isPublic: false}),
    showToast: jest.fn(),
    ...overrides,
});

describe('NoteManagementDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render dialog when open is true', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
                expect(screen.getByText('Add Note')).toBeInTheDocument();
            });
        });

        it('should not render dialog when open is false', async () => {
            const props = createMockProps({open: false});
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should display "Edit Note" title for existing notes', async () => {
            const props = createMockProps({note: mockNote});
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(screen.getByText('Edit Note')).toBeInTheDocument();
            });
        });

        it('should load note types on open', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });
        });

        it('should populate form with existing note data', async () => {
            const props = createMockProps({note: mockNote});
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(screen.getByDisplayValue('This is an existing note')).toBeInTheDocument();
            });
        });

        it('should display metadata section for existing notes', async () => {
            const props = createMockProps({note: mockNote});
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(screen.getByText('Note Information')).toBeInTheDocument();
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });
        });

        it('should not display metadata section for new notes', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            expect(screen.queryByText('Note Information')).not.toBeInTheDocument();
        });
    });

    describe('Note Type Selection', () => {
        it('should show public note warning when public type selected', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            // Wait for the select to be rendered
            await waitFor(() => {
                expect(screen.getByRole('combobox')).toBeInTheDocument();
            });

            // Open dropdown and select public type
            const selectButton = screen.getByRole('combobox');
            await act(async () => {
                await userEvent.click(selectButton);
            });

            const customerOption = await screen.findByText('Customer');
            await act(async () => {
                await userEvent.click(customerOption);
            });

            await waitFor(() => {
                expect(screen.getByText(/public note that will be visible to clients/)).toBeInTheDocument();
            });
        });

        it('should toggle description visibility', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(screen.getByText('View Description')).toBeInTheDocument();
            });

            const toggleButton = screen.getByText('View Description');
            await act(async () => {
                await userEvent.click(toggleButton);
            });

            await waitFor(() => {
                expect(screen.getByText('General notes')).toBeInTheDocument();
            });
        });
    });

    describe('Note Content', () => {
        it('should update note text as user types', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            // Wait for dialog content to render
            await waitFor(() => {
                expect(screen.getByPlaceholderText('Enter your note content here...')).toBeInTheDocument();
            });

            const textarea = screen.getByPlaceholderText('Enter your note content here...');
            await act(async () => {
                await userEvent.type(textarea, 'My test note');
            });

            expect(screen.getByDisplayValue('My test note')).toBeInTheDocument();
        });

        it('should show character count', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(screen.getByText('0/1000 characters')).toBeInTheDocument();
            });
        });

        it('should toggle important flag', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            // Find checkbox by its label text
            const importantCheckbox = screen.getByRole('checkbox', {name: /mark as important/i});
            await act(async () => {
                await userEvent.click(importantCheckbox);
            });

            expect(importantCheckbox).toBeChecked();
        });
    });

    describe('Form Validation', () => {
        it('should disable save button when note text is empty', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            const saveButton = screen.getByRole('button', {name: /save note/i});
            expect(saveButton).toBeDisabled();
        });

        it('should enable save button when form is valid', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            // Wait for textarea to be available
            await waitFor(() => {
                expect(screen.getByPlaceholderText('Enter your note content here...')).toBeInTheDocument();
            });

            const textarea = screen.getByPlaceholderText('Enter your note content here...');
            await act(async () => {
                await userEvent.type(textarea, 'Valid note content');
            });

            await waitFor(() => {
                const saveButton = screen.getByRole('button', {name: /save note/i});
                expect(saveButton).toBeEnabled();
            });
        });
    });

    describe('Save Functionality', () => {
        it('should call onCreateNote for new notes', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            // Wait for textarea to be available
            await waitFor(() => {
                expect(screen.getByPlaceholderText('Enter your note content here...')).toBeInTheDocument();
            });

            const textarea = screen.getByPlaceholderText('Enter your note content here...');
            await act(async () => {
                await userEvent.type(textarea, 'New note content');
            });

            const saveButton = screen.getByRole('button', {name: /save note/i});
            await act(async () => {
                await userEvent.click(saveButton);
            });

            await waitFor(() => {
                expect(props.onCreateNote).toHaveBeenCalled();
                expect(props.showToast).toHaveBeenCalledWith('Note created successfully', 'success');
            });
        });

        it('should call onUpdateNote for existing notes', async () => {
            const props = createMockProps({note: mockNote});
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            // Wait for form to be populated with existing note data
            await waitFor(() => {
                expect(screen.getByDisplayValue('This is an existing note')).toBeInTheDocument();
            });

            const textarea = screen.getByDisplayValue('This is an existing note');
            await act(async () => {
                await userEvent.clear(textarea);
                await userEvent.type(textarea, 'Updated note content');
            });

            const saveButton = screen.getByRole('button', {name: /save note/i});
            await act(async () => {
                await userEvent.click(saveButton);
            });

            await waitFor(() => {
                expect(props.onUpdateNote).toHaveBeenCalledWith(expect.objectContaining({
                    noteId: 123,
                    noteText: 'Updated note content',
                }));
            });
        });

        it('should handle save errors gracefully', async () => {
            const props = createMockProps({
                note: mockNote,
                onUpdateNote: jest.fn().mockRejectedValue(new Error('Network error')),
            });
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            // Wait for form to be populated
            await waitFor(() => {
                expect(screen.getByDisplayValue('This is an existing note')).toBeInTheDocument();
            });

            const saveButton = screen.getByRole('button', {name: /save note/i});
            await act(async () => {
                await userEvent.click(saveButton);
            });

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith('Failed to save note', 'error');
            });
        });
    });

    describe('Close Functionality', () => {
        it('should call onClose when cancel button clicked', async () => {
            const props = createMockProps();
            await act(async () => {
                renderWithTheme(<NoteManagementDialog {...props} />);
            });

            await waitFor(() => {
                expect(props.onLoadNoteTypes).toHaveBeenCalled();
            });

            const cancelButton = screen.getByRole('button', {name: /cancel/i});
            await act(async () => {
                await userEvent.click(cancelButton);
            });

            expect(props.onClose).toHaveBeenCalled();
        });
    });
});
