/**
 * Tests for PanelHeader — the shared gradient card-panel header.
 *
 * Assertions query by visible text / role (not class names) so styling
 * refactors don't break them.
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import {PanelHeader} from './PanelHeader';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('PanelHeader', () => {
    it('renders the title on its own', () => {
        renderWithTheme(<PanelHeader icon={<TuneIcon />} title="Filters" />);
        expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('appends the count as "(n)" when provided', () => {
        renderWithTheme(<PanelHeader icon={<TuneIcon />} title="Recurring Jobs" count={12} />);
        expect(screen.getByText('Recurring Jobs (12)')).toBeInTheDocument();
    });

    it('omits the count when undefined', () => {
        renderWithTheme(<PanelHeader icon={<TuneIcon />} title="Recurring Jobs" />);
        expect(screen.getByText('Recurring Jobs')).toBeInTheDocument();
    });

    it('renders a Material Symbols span icon (non-MUI glyph)', () => {
        renderWithTheme(
            <PanelHeader
                icon={<span className="material-symbols-outlined">tune</span>}
                title="Quick Filters"
            />,
        );
        expect(screen.getByText('tune')).toBeInTheDocument();
        expect(screen.getByText('Quick Filters')).toBeInTheDocument();
    });

    it('renders the badge chip when provided', () => {
        renderWithTheme(<PanelHeader icon={<TuneIcon />} title="Recurring Log" badge="RECURRING" />);
        expect(screen.getByText('RECURRING')).toBeInTheDocument();
    });

    it('renders the action slot and fires its handler', async () => {
        const user = userEvent.setup();
        const onClick = jest.fn();
        renderWithTheme(
            <PanelHeader
                icon={<TuneIcon />}
                title="Recurring Log"
                action={
                    <IconButton aria-label="Refresh" onClick={onClick}>
                        <RefreshIcon />
                    </IconButton>
                }
            />,
        );

        const button = screen.getByRole('button', {name: 'Refresh'});
        await user.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
