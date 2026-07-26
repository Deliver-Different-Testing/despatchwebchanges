import React from 'react';
import {render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {SplitJobProgressDialog} from './SplitJobProgressDialog';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('SplitJobProgressDialog', () => {
    it('renders the header, job number, and a progress bar when open', () => {
        renderWithTheme(<SplitJobProgressDialog open jobNo="JOB-001"/>);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Splitting Job'})).toBeInTheDocument();
        expect(screen.getByText('Job JOB-001')).toBeInTheDocument();
        expect(screen.getByText(/Splitting job JOB-001/)).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('has no close button (not dismissable)', () => {
        renderWithTheme(<SplitJobProgressDialog open jobNo="JOB-001"/>);
        expect(screen.queryByRole('button', {name: /close dialog/i})).not.toBeInTheDocument();
    });

    it('does not render when closed', () => {
        renderWithTheme(<SplitJobProgressDialog open={false} jobNo="JOB-001"/>);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
