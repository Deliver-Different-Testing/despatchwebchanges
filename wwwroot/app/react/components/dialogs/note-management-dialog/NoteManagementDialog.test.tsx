/**
 * NoteManagementDialog Component Tests
 *
 * Optimised: tests sharing identical setup consolidated into single renders.
 */

import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {NoteManagementDialog} from './NoteManagementDialog';
import {NoteManagementDialogProps} from './types';
import {JobNote, NoteType} from '../../../interfaces/notes';
import {testTheme} from '../../../__testUtils__';

// Mock the dateUtils module
jest.mock('../../../utils/dateUtils', () => ({
    getTimezoneAbbreviation: jest.fn(() => '(PST)'),
}));

// Mock useNoteHistory hook used by the component
jest.mock('../../../hooks/useNotesApi', () => ({
    useNoteHistory: jest.fn(() => ({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
    })),
}));

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {retry: false, gcTime: 0},
        },
    });

const renderWithTheme = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={testTheme}>
                {ui}
            </ThemeProvider>
        </QueryClientProvider>
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
    // ── New note render: dialog, title, note types loaded, no metadata, char count, save disabled (single render) ─
    it('renders new note dialog with correct initial state', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Add Note')).toBeInTheDocument();
            expect(props.onLoadNoteTypes).toHaveBeenCalled();
        });

        // No metadata section for new notes
        expect(screen.queryByText('Note Information')).not.toBeInTheDocument();

        // Character count
        expect(screen.getByText('0/1000 characters')).toBeInTheDocument();

        // Save button disabled when empty
        expect(screen.getByRole('button', {name: /save note/i})).toBeDisabled();
    });

    // ── Closed dialog ───────────────────────────────────────────────
    it('should not render dialog when open is false', async () => {
        const props = createMockProps({open: false});
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // ── Edit note render: title, form populated, metadata (single render) ─
    it('renders edit note dialog with populated form and metadata', async () => {
        const props = createMockProps({note: mockNote});
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        expect(await screen.findByText('Edit Note')).toBeInTheDocument();
        expect(screen.getByDisplayValue('This is an existing note')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Note Information')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
    });

    // ── Note type selection: public warning + description toggle (single render) ─
    it('shows public note warning and toggles description visibility', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadNoteTypes).toHaveBeenCalled();
        });

        // Toggle description
        expect(await screen.findByText('View Description')).toBeInTheDocument();
        await act(async () => {
            await userEvent.click(screen.getByText('View Description'));
        });
        expect(await screen.findByText('General notes')).toBeInTheDocument();

        // Select public type
        const selectButton = screen.getByRole('combobox');
        await act(async () => {
            await userEvent.click(selectButton);
        });
        const customerOption = await screen.findByText('Customer');
        await act(async () => {
            await userEvent.click(customerOption);
        });
        expect(await screen.findByText(/public note that will be visible to clients/)).toBeInTheDocument();
    });

    // ── Note content: type text, toggle important, save enabled (single render) ─
    it('updates note text, toggles important flag, and enables save', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadNoteTypes).toHaveBeenCalled();
        });

        expect(await screen.findByPlaceholderText('Enter your note content here...')).toBeInTheDocument();

        // Type text
        const textarea = screen.getByPlaceholderText('Enter your note content here...');
        fireEvent.change(textarea, {target: {value: 'My test note'}});
        expect(screen.getByDisplayValue('My test note')).toBeInTheDocument();

        // Toggle important
        const importantCheckbox = screen.getByRole('checkbox', {name: /mark as important/i});
        await act(async () => {
            await userEvent.click(importantCheckbox);
        });
        expect(importantCheckbox).toBeChecked();

        // Save button now enabled
        expect(screen.getByRole('button', {name: /save note/i})).toBeEnabled();
    });

    // ── Create note + cancel (single render) ────────────────────────
    it('calls onClose on cancel and onCreateNote on save for new notes', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadNoteTypes).toHaveBeenCalled();
        });

        // Cancel
        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await act(async () => {
            await userEvent.click(cancelButton);
        });
        expect(props.onClose).toHaveBeenCalled();

        // Fill text and save
        expect(await screen.findByPlaceholderText('Enter your note content here...')).toBeInTheDocument();
        const textarea = screen.getByPlaceholderText('Enter your note content here...');
        fireEvent.change(textarea, {target: {value: 'New note content'}});

        const saveButton = screen.getByRole('button', {name: /save note/i});
        await act(async () => {
            await userEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(props.onCreateNote).toHaveBeenCalled();
            expect(props.showToast).toHaveBeenCalledWith('Note created successfully', 'success');
        });
    });

    // ── Update existing note ────────────────────────────────────────
    it('should call onUpdateNote for existing notes', async () => {
        const props = createMockProps({note: mockNote});
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadNoteTypes).toHaveBeenCalled();
        });

        expect(await screen.findByDisplayValue('This is an existing note')).toBeInTheDocument();

        const textarea = screen.getByDisplayValue('This is an existing note');
        fireEvent.change(textarea, {target: {value: 'Updated note content'}});

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

    // ── Save error handling ─────────────────────────────────────────
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

        expect(await screen.findByDisplayValue('This is an existing note')).toBeInTheDocument();

        const saveButton = screen.getByRole('button', {name: /save note/i});
        await act(async () => {
            await userEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith('Failed to save note', 'error');
        });
    });
});
