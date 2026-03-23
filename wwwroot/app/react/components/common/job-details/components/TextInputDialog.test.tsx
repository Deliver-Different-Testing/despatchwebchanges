/** @jest-environment jest-environment-jsdom */
/**
 * TextInputDialog Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
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
        placeholder: 'Enter reference',
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

    it('calls onCancel when Cancel button clicked', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit with current value when Save clicked', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', {name: 'Save'}));
        expect(defaultProps.onSubmit).toHaveBeenCalledWith('REF-001');
    });

    it('updates value as user types', () => {
        renderWithTheme(<TextInputDialog {...defaultProps} />);

        const input = screen.getByDisplayValue('REF-001');
        fireEvent.change(input, {target: {value: 'NEW-REF'}});

        fireEvent.click(screen.getByRole('button', {name: 'Save'}));
        expect(defaultProps.onSubmit).toHaveBeenCalledWith('NEW-REF');
    });

    it('disables Save when required and value is empty', async () => {
        const user = userEvent.setup();
        renderWithTheme(<TextInputDialog {...defaultProps} required={true} />);

        const input = screen.getByDisplayValue('REF-001');
        await user.clear(input);

        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    });

    it('does not submit on Enter when required and value is empty', async () => {
        const user = userEvent.setup();
        renderWithTheme(<TextInputDialog {...defaultProps} required={true} initialValue="" />);

        const input = screen.getByRole('textbox');
        await user.type(input, '{Enter}');

        expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('submits on Enter key when value is valid', async () => {
        const user = userEvent.setup();
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
