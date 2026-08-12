/**
 * TextInputDialog Component Tests
 */

import React from 'react';
import { setupUser } from '../../../../__testUtils__/setupUser';
import {screen, fireEvent} from '@testing-library/react';
import {TextInputDialog} from './TextInputDialog';
import {renderWithMantine as renderWithTheme} from '../../../../__testUtils__';

describe('TextInputDialog', () => {
    const defaultProps = {
        open: true,
        title: 'Edit Reference',
        label: 'Enter reference',
        initialValue: 'REF-001',
        onSubmit: jest.fn(),
        onCancel: jest.fn(),
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when closed', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} open={false} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog with title and initial value when open', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit Reference')).toBeInTheDocument();
        expect(screen.getByDisplayValue('REF-001')).toBeInTheDocument();
    });

    it('renders the floating label on the text field', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        expect(screen.getByLabelText('Enter reference')).toBeInTheDocument();
    });

    it('calls onCancel when Cancel button clicked', async () => {
        const user = setupUser({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: 'Cancel'}));
        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit with current value when Save clicked', async () => {
        const user = setupUser({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: 'Save'}));
        expect(defaultProps.onSubmit).toHaveBeenCalledWith('REF-001');
    });

    // `user.click` does not focus an input inside a Mantine Modal, so typing has
    // to be driven with `fireEvent.change` rather than clear + paste.
    it('updates value as user types and submits new value', async () => {
        const user = setupUser({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} />);

        fireEvent.change(screen.getByDisplayValue('REF-001'), {target: {value: 'NEW-REF'}});

        await user.click(screen.getByRole('button', {name: 'Save'}));
        expect(defaultProps.onSubmit).toHaveBeenCalledWith('NEW-REF');
    });

    it('disables Save and shows helper text when required and value is empty', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} required={true} />);

        fireEvent.change(screen.getByDisplayValue('REF-001'), {target: {value: ''}});

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('does not submit on Enter when required and value is empty', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} required={true} initialValue="" />);

        fireEvent.submit(screen.getByRole('textbox').closest('form')!);

        expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('submits on Enter key when value is valid', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} />);

        fireEvent.submit(screen.getByDisplayValue('REF-001').closest('form')!);

        expect(defaultProps.onSubmit).toHaveBeenCalledWith('REF-001');
    });

    it('uses custom button labels', () => {
        renderWithTheme(
            <TextInputDialog {...defaultProps} okLabel="Update" cancelLabel="Discard" />
        );
        expect(screen.getByRole('button', {name: 'Update'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Discard'})).toBeInTheDocument();
    });

    it('does not show Clear button unless allowClear is set', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        expect(screen.queryByRole('button', {name: 'Clear'})).not.toBeInTheDocument();
    });

    it('shows Clear button when allowClear is set and a value exists', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} allowClear />);
        expect(screen.getByRole('button', {name: 'Clear'})).toBeInTheDocument();
    });

    it('hides Clear button when allowClear is set but the value is empty', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} allowClear initialValue="" />);
        expect(screen.queryByRole('button', {name: 'Clear'})).not.toBeInTheDocument();
    });

    it('submits an empty value when Clear is clicked', async () => {
        const user = setupUser({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} allowClear />);
        await user.click(screen.getByRole('button', {name: 'Clear'}));
        expect(defaultProps.onSubmit).toHaveBeenCalledWith('');
    });

    it('resets value when reopened with new initialValue', () => {
        const {rerender} = renderWithTheme(<TextInputDialog {...defaultProps} open={false} />);
        // The provider comes from `renderWithMantine`'s wrapper, so the rerender
        // must not re-wrap it — that would remount the subtree.
        rerender(<TextInputDialog {...defaultProps} open={true} initialValue="NEW-VALUE" />);
        expect(screen.getByDisplayValue('NEW-VALUE')).toBeInTheDocument();
    });
});
