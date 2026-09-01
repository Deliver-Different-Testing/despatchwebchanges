/**
 * Tests for PanelHeader — the shared card-panel header.
 *
 * Assertions query by visible text / role / test id (not class names) so
 * styling refactors don't break them.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {screen} from '@testing-library/react';
import {ActionIcon} from '@mantine/core';
import {RefreshCw, SlidersHorizontal} from 'lucide-react';
import {PanelHeader} from './PanelHeader';
import {Icon} from '../icon/Icon';
import {SymbolIcon} from '../symbol-icon';
import {renderWithMantine} from '../../../__testUtils__';

// SymbolIcon is still MUI, so one MUI theme has to remain in scope for that case.
const renderPanel = (ui: React.ReactElement) => renderWithMantine(ui);

const tune = <Icon lucide={SlidersHorizontal}/>;

describe('PanelHeader', () => {
    it('renders the title, appends a count as "(n)", and omits it when undefined', () => {
        const {rerender} = renderPanel(<PanelHeader icon={tune} title="Filters" />);
        expect(screen.getByText('Filters')).toBeInTheDocument();

        rerender(<PanelHeader icon={tune} title="Recurring Jobs" count={12} />);
        expect(screen.getByText('Recurring Jobs (12)')).toBeInTheDocument();

        rerender(<PanelHeader icon={tune} title="Recurring Jobs" />);
        expect(screen.getByText('Recurring Jobs')).toBeInTheDocument();
    });

    it('renders a SymbolIcon glyph as an svg badge', () => {
        const {container} = renderPanel(
            <PanelHeader icon={<SymbolIcon name="tune" />} title="Quick Filters" />,
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
        expect(screen.getByText('Quick Filters')).toBeInTheDocument();
    });

    it('renders the badge chip when provided', () => {
        renderPanel(<PanelHeader icon={tune} title="Recurring Log" badge="RECURRING" />);
        expect(screen.getByText('RECURRING')).toBeInTheDocument();
    });

    it('renders the action slot and fires its handler', async () => {
        const user = setupUser();
        const onClick = jest.fn();
        renderPanel(
            <PanelHeader
                icon={tune}
                title="Recurring Log"
                action={
                    <ActionIcon aria-label="Refresh" onClick={onClick} variant="subtle">
                        <Icon lucide={RefreshCw}/>
                    </ActionIcon>
                }
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Refresh'}));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    /**
     * The `'surface'` variant is what makes this read as part of its card: the bar
     * shares the card's fill and is separated by a keyline, rather than carrying a
     * brand colour like a dialog header. Asserted on longhands — jsdom drops a
     * `border-bottom` shorthand that carries a `var()`.
     */
    it('is a plain paper bar with a keyline, not a brand-coloured fill', () => {
        renderPanel(<PanelHeader icon={tune} title="Filters" />);

        const bar = screen.getByTestId('panel-header');
        expect(bar).toHaveStyle({
            backgroundColor: 'var(--dd-surface-container)',
            color: 'var(--mantine-color-text)',
        });
        // The keyline itself is unassertable here: `headerChromeStyle` writes the
        // `border-bottom` *shorthand*, and jsdom drops any shorthand carrying a
        // `var()`. The variant tokens above are what select it.
        expect(bar).not.toHaveStyle({backgroundColor: 'var(--mantine-primary-color-filled)'});
    });

    /**
     * The leading glyph is bare — no badge, no wash behind it — and takes the bar's
     * own on-colour, which is scheme-aware, so it inverts with the text in dark mode
     * rather than staying a fixed brand accent.
     */
    it('renders the leading glyph bare, inheriting the bar colour', () => {
        const {container} = renderPanel(<PanelHeader icon={tune} title="Filters" />);

        expect(container.querySelector('.mantine-ThemeIcon-root')).toBeNull();

        const glyphWrapper = screen.getByTestId('panel-header-icon');
        expect(glyphWrapper).toHaveStyle({color: 'inherit'});
        expect(glyphWrapper.style.backgroundColor).toBe('');
        expect(glyphWrapper.querySelector('svg')).toBeInTheDocument();
    });

    it('labels the badge chip in body text, not the low-contrast brand accent', () => {
        renderPanel(<PanelHeader icon={tune} title="Recurring Log" badge="RECURRING" />);

        // 10px bold on the brand wash needs the darker body colour to clear AA, which
        // is what `variant="default"` gives — no brand tint on the label.
        const chip = screen.getByText('RECURRING').closest('.mantine-Badge-root');
        expect(chip).toHaveAttribute('data-variant', 'default');
    });
});
