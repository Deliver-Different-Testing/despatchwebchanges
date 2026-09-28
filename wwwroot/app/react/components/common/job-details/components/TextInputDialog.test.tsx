/** @jest-environment jest-environment-jsdom */
/**
 * TextInputDialog Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {TextInputDialog} from './TextInputDialog';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

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
        const user = userEvent.setup({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: 'Cancel'}));
        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit with current value when Save clicked', async () => {
        const user = userEvent.setup({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        await user.click(screen.getByRole('button', {name: 'Save'}));
        expect(defaultProps.onSubmit).toHaveBeenCalledWith('REF-001');
    });

    it('updates value as user types and submits new value', async () => {
        const user = userEvent.setup({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} />);

        const input = screen.getByDisplayValue('REF-001');
        await user.clear(input);
        await user.type(input, 'NEW-REF');

        await user.click(screen.getByRole('button', {name: 'Save'}));
        expect(defaultProps.onSubmit).toHaveBeenCalledWith('NEW-REF');
    });

    it('disables Save and shows helper text when required and value is empty', async () => {
        const user = userEvent.setup({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} required={true} />);

        const input = screen.getByDisplayValue('REF-001');
        await user.clear(input);

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('does not submit on Enter when required and value is empty', async () => {
        const user = userEvent.setup({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} required={true} initialValue="" />);

        const input = screen.getByRole('textbox');
        await user.type(input, '{Enter}');

        expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('submits on Enter key when value is valid', async () => {
        const user = userEvent.setup({delay: null});
        renderWithTheme(<TextInputDialog {...defaultProps} />);

        const input = screen.getByDisplayValue('REF-001');
        await user.type(input, '{Enter}');

        expect(defaultProps.onSubmit).toHaveBeenCalledWith('REF-001');
    });

    it('uses custom button labels', () => {
        renderWithTheme(
            <TextInputDialog {...defaultProps} okLabel="Update" cancelLabel="Discard" />
        );
        expect(screen.getByRole('button', {name: 'Update'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Discard'})).toBeInTheDocument();
    });

    it('resets value when reopened with new initialValue', () => {
        const {rerender} = renderWithTheme(<TextInputDialog {...defaultProps} open={false} />);
        rerender(
            <ThemeProvider theme={theme}>
                <TextInputDialog {...defaultProps} open={true} initialValue="NEW-VALUE" />
            </ThemeProvider>
        );
        expect(screen.getByDisplayValue('NEW-VALUE')).toBeInTheDocument();
    });
});
