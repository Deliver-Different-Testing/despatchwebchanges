/**
 * NoteManagementDialog Component Tests
 *
 * Optimised: tests sharing identical setup consolidated into single renders.
 */

import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {NoteManagementDialog} from './NoteManagementDialog';
import {NoteManagementDialogProps} from './types';
import {JobNote, NoteType} from '../../../interfaces/notes';
import { renderWithMantineProviders } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

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

// renderWithMantineProviders supplies a fresh no-retry, zero-gcTime QueryClient.
const renderWithTheme = (ui: React.ReactElement) => renderWithMantineProviders(ui);

const mockNoteTypes: NoteType[] = [
    {id: 1, text: 'General', isPublic: false, description: 'General notes'},
    {id: 2, text: 'Customer', isPublic: true, description: 'Customer-visible notes'},
    {id: 3, text: 'Internal', isPublic: false},
    {id: 4, text: 'Dispatch', isPublic: false, isCourierFacing: true, description: 'Courier-visible notes'},
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

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Add Note')).toBeInTheDocument();
        expect(props.onLoadNoteTypes).toHaveBeenCalled();

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

        expect(await screen.findByText('Note Information')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // ── Note type selection: public + courier warnings + description toggle (single render) ─
    it('shows public and courier note warnings and toggles description visibility', async () => {
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
        expect(screen.queryByText(/courier note that will be visible to couriers/)).not.toBeInTheDocument();

        // Select courier-facing type
        await act(async () => {
            await userEvent.click(screen.getByRole('combobox'));
        });
        const dispatchOption = await screen.findByText('Dispatch');
        await act(async () => {
            await userEvent.click(dispatchOption);
        });
        expect(await screen.findByText(/courier note that will be visible to couriers/)).toBeInTheDocument();
        expect(screen.queryByText(/public note that will be visible to clients/)).not.toBeInTheDocument();
    });

    // ── Create note type: courier-facing checkbox reveals warning and flows to onCreateNoteType ─
    it('creates a courier-facing note type with a warning shown while ticked', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadNoteTypes).toHaveBeenCalled();
        });

        // Open the "Create New Note Type" sub-form
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Add note type'}));
        });

        expect(await screen.findByText('Create New Note Type')).toBeInTheDocument();

        // Name the new type
        const nameField = screen.getByRole('textbox', {name: /note type name/i});
        fireEvent.change(nameField, {target: {value: 'Dispatch'}});

        // Tick courier-facing → warning appears
        const courierCheckbox = screen.getByRole('checkbox', {name: /is courier facing note type/i});
        await act(async () => {
            await userEvent.click(courierCheckbox);
        });
        expect(await screen.findByText(/courier note types are visible to couriers/i)).toBeInTheDocument();

        // Submit the new type
        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Create Note Type'}));
        });

        await waitFor(() => {
            expect(props.onCreateNoteType).toHaveBeenCalledWith(
                expect.objectContaining({text: 'Dispatch', isCourierFacing: true})
            );
        });
    });

    // ── Tall content must not strand the footer (the shell's scroll container) ─
    it('keeps Save Note reachable once the note-type creator expands the dialog', async () => {
        const props = createMockProps();
        await act(async () => {
            renderWithTheme(<NoteManagementDialog {...props} />);
        });

        await waitFor(() => {
            expect(props.onLoadNoteTypes).toHaveBeenCalled();
        });

        await act(async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Add note type'}));
        });
        expect(await screen.findByText('Create New Note Type')).toBeInTheDocument();

        // jsdom does no layout, so this asserts the wiring rather than the pixels:
        // the modal keeps its scroll container and the footer pins to it.
        expect(screen.getByRole('dialog')).toHaveStyle({overflowY: 'auto'});
        expect(screen.getByRole('button', {name: 'Save Note'}).parentElement)
            .toHaveStyle({position: 'sticky', bottom: '0px'});
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
