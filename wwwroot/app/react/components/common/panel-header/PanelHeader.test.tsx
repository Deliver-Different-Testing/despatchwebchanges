/**
 * Tests for PanelHeader — the shared card-panel header.
 *
 * Assertions query by visible text / role / test id (not class names) so
 * styling refactors don't break them.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {createAppTheme} from '../../../theme/muiTheme';
import IconButton from '@mui/material/IconButton';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import {PanelHeader} from './PanelHeader';
import {SymbolIcon} from '../symbol-icon';

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

    it('renders a SymbolIcon glyph as an svg badge', () => {
        const {container} = renderWithTheme(
            <PanelHeader icon={<SymbolIcon name="tune" />} title="Quick Filters" />,
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
        expect(screen.getByText('Quick Filters')).toBeInTheDocument();
    });

    it('renders the badge chip when provided', () => {
        renderWithTheme(<PanelHeader icon={<TuneIcon />} title="Recurring Log" badge="RECURRING" />);
        expect(screen.getByText('RECURRING')).toBeInTheDocument();
    });

    it('renders the action slot and fires its handler', async () => {
        const user = setupUser();
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

    it('is a plain paper bar with a keyline, not a brand-coloured fill', () => {
        const appTheme = createAppTheme();
        render(
            <ThemeProvider theme={appTheme}>
                <PanelHeader icon={<TuneIcon />} title="Filters" />
            </ThemeProvider>,
        );

        const bar = screen.getByTestId('panel-header');
        expect(bar).toHaveStyle({backgroundColor: appTheme.palette.background.paper});
        expect(bar).toHaveStyle({borderBottom: `1px solid ${appTheme.palette.divider}`});
        expect(bar).not.toHaveStyle({backgroundColor: appTheme.palette.primary.main});
    });

    it('labels the badge chip in body text, not the low-contrast brand accent', () => {
        const appTheme = createAppTheme();
        render(
            <ThemeProvider theme={appTheme}>
                <PanelHeader icon={<TuneIcon />} title="Recurring Log" badge="RECURRING" />
            </ThemeProvider>,
        );

        // 10px bold on the brand wash needs the darker body colour to clear AA.
        expect(screen.getByText('RECURRING').closest('.MuiChip-root'))
            .toHaveStyle({color: appTheme.palette.text.primary});
    });
});
