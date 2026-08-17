import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    DialogShell,
    DialogHeader,
    DialogFooter,
    dialogSize,
    headerChipProps,
    headerSurfaceAccent,
    headerChromeStyle,
    headerColors,
    headerOnColor,
    headerOverlayColor,
    dialogShellStyles,
    dialogStickyChromeStyle,
    PriceDelta,
} from './index';
import {alpha} from '@mantine/core';
import {getHeaderColors, getHeaderSurfaceAccent} from './styles';
import {dfrntBrand} from '../../../../theme/dfrntMantineTheme';
import {dfrntPrimaryPalette, urgentPrimaryPalette} from '../../../../theme/palettes';
import {renderWithMantine} from '../../../../__testUtils__';

interface Handlers {
    onClose?: () => void;
    onCancel?: () => void;
    onConfirm?: () => void;
    submitting?: boolean;
}

function renderDialog(h: Handlers = {}) {
    const onClose = h.onClose ?? jest.fn();
    return renderWithMantine(
        <DialogShell opened onClose={onClose}>
            <DialogHeader
                icon={<span data-testid="header-icon"/>}
                title="Edit price"
                subtitle="Job 1234"
                onClose={onClose}
            />
            <DialogFooter
                onCancel={h.onCancel ?? jest.fn()}
                onConfirm={h.onConfirm ?? jest.fn()}
                confirmLabel="Save"
                submitting={h.submitting}
            />
        </DialogShell>,
    );
}

describe('Mantine dialog primitives', () => {
    it('renders the shell, title, subtitle and both actions', () => {
        renderDialog();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit price')).toBeInTheDocument();
        expect(screen.getByText('Job 1234')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    });

    it('fires onClose from the header close button', async () => {
        const onClose = jest.fn();
        renderDialog({onClose});
        await userEvent.click(screen.getByRole('button', {name: 'Close dialog'}));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('fires the footer callbacks', async () => {
        const onCancel = jest.fn();
        const onConfirm = jest.fn();
        renderDialog({onCancel, onConfirm});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('disables Cancel and shows the confirm loader while submitting', () => {
        renderDialog({submitting: true});
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Save'})).toHaveAttribute('data-loading', 'true');
    });

    it('scrims the page behind the dialog without blurring it', () => {
        const {container} = renderDialog();
        const overlay = container.querySelector('.mantine-Modal-overlay') as HTMLElement;
        expect(overlay).toBeTruthy();
        expect(overlay.style.getPropertyValue('--overlay-filter')).toBe('');
        expect(overlay.style.getPropertyValue('--overlay-bg')).toContain('0.25');
    });

    it('lets a dialog override the overlay defaults', () => {
        const {container} = renderWithMantine(
            <DialogShell opened onClose={jest.fn()} overlayProps={{backgroundOpacity: 0.8, blur: 4}}>
                <DialogHeader icon={<span/>} title="Photo" onClose={jest.fn()}/>
            </DialogShell>,
        );
        const overlay = container.querySelector('.mantine-Modal-overlay') as HTMLElement;
        expect(overlay.style.getPropertyValue('--overlay-filter')).toContain('blur(');
        expect(overlay.style.getPropertyValue('--overlay-bg')).toContain('0.8');
    });
});

/**
 * `Modal.Content` is the modal's only scroll container — Mantine caps it at ~90dvh
 * and scrolls it. A shell that clips it instead strands everything past the cap,
 * the footer's confirm button included.
 */
describe('DialogShell scrolling', () => {
    it('keeps the modal content scrollable', () => {
        renderDialog();
        // `Modal.Content` is the role="dialog" node.
        expect(screen.getByRole('dialog')).toHaveStyle({overflowY: 'auto'});
        expect(screen.getByRole('dialog')).not.toHaveStyle({overflow: 'hidden'});
    });

    it('still lets a caller override the shell styles', () => {
        renderWithMantine(
            <DialogShell opened onClose={jest.fn()} styles={{content: {overflowY: 'scroll'}}}>
                <DialogHeader icon={<span/>} title="Edit price" onClose={jest.fn()}/>
            </DialogShell>,
        );
        expect(screen.getByRole('dialog')).toHaveStyle({overflowY: 'scroll'});
    });

    it('pins the header and the footer so the actions stay on screen while the body scrolls', () => {
        renderDialog();
        expect(screen.getByRole('button', {name: 'Close dialog'}).parentElement)
            .toHaveStyle({position: 'sticky', top: '0px'});
        expect(screen.getByRole('button', {name: 'Cancel'}).parentElement)
            .toHaveStyle({position: 'sticky', bottom: '0px'});
    });

    it('exposes the shell and chrome styles as plain objects', () => {
        expect(dialogShellStyles.content.overflowY).toBe('auto');
        expect(dialogShellStyles.body.padding).toBe(0);
        expect(dialogStickyChromeStyle('top')).toMatchObject({position: 'sticky', top: 0});
        expect(dialogStickyChromeStyle('bottom')).toMatchObject({position: 'sticky', bottom: 0});
    });
});

describe('DialogFooter options', () => {
    it('drops the confirm button for view-only dialogs', () => {
        renderWithMantine(
            <DialogFooter onCancel={jest.fn()} onConfirm={jest.fn()} confirmLabel="Save" hideConfirm/>,
        );
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    it('renders a secondary action between Cancel and Confirm', () => {
        renderWithMantine(
            <DialogFooter
                onCancel={jest.fn()}
                onConfirm={jest.fn()}
                confirmLabel="Save"
                secondaryAction={<button>Reset</button>}
            />,
        );
        const buttons = screen.getAllByRole('button').map((b) => b.textContent);
        expect(buttons).toEqual(['Cancel', 'Reset', 'Save']);
    });
});

describe('header style helpers', () => {
    it('paints the chrome with the variant fill and its on-colour', () => {
        const chrome = headerChromeStyle('error');
        expect(chrome.backgroundColor).toBe(headerColors.error.bg);
        expect(chrome.color).toBe(headerColors.error.fg);
        expect(chrome.display).toBe('flex');
    });

    it('defaults to the primary variant', () => {
        expect(headerChromeStyle().backgroundColor).toBe(headerColors.primary.bg);
        expect(headerOnColor()).toBe(headerColors.primary.fg);
    });

    it('sizes the icon chip and scrims it in the on-colour', () => {
        // A ThemeIcon prop bag, not a style object: size/radius are real props
        // and the scrim rides ThemeIcon's own CSS variables.
        expect(headerChipProps('warning')).toMatchObject({size: 40, radius: 'md'});
        expect(headerChipProps('warning', 32)).toMatchObject({size: 32});
        expect(headerChipProps('warning').style['--ti-bg']).toBe(headerOverlayColor(0.18, 'warning'));
        expect(headerChipProps('warning').style['--ti-color']).toBe(headerColors.warning.fg);
    });

    it('fills the primary header with the tenant primary — matching the MUI dialogs', () => {
        // Asserted through the factories rather than the module-level `headerColors`,
        // which is bound to whichever tenant the bundle booted in.
        //
        // These must equal the MUI `headerChromeSx` fill (`palette.primary.main` +
        // `contrastText`) so a Mantine dialog and an unmigrated MUI one opened in
        // the same session wear the same header. Both hues are light, so the
        // on-colour is Ink on either tenant.
        expect(getHeaderColors(true).primary).toEqual({bg: dfrntPrimaryPalette[500], fg: dfrntBrand.inkBlue});
        expect(getHeaderColors(false).primary).toEqual({bg: urgentPrimaryPalette[500], fg: dfrntBrand.inkBlue});
    });

    it('keeps the semantic fills and the neutral bar off the tenant switch', () => {
        for (const variant of ['secondary', 'info', 'success', 'warning', 'error', 'surface'] as const) {
            expect(getHeaderColors(false)[variant]).toEqual(getHeaderColors(true)[variant]);
        }
        // The on-paper brand accent still follows the tenant, even though the neutral
        // bar no longer uses it.
        expect(getHeaderSurfaceAccent(false)).toBe(dfrntBrand.goldDeep);
        expect(getHeaderSurfaceAccent(true)).not.toBe(getHeaderSurfaceAccent(false));
    });

    it('gives the page-card surface variant a keyline instead of a fill', () => {
        const chrome = headerChromeStyle('surface');
        expect(chrome.backgroundColor).toBe(headerColors.surface.bg);
        expect(chrome.borderBottom).toBe('1px solid var(--mantine-color-default-border)');
        expect(headerChromeStyle('error').borderBottom).toBe('none');
    });

    /**
     * The neutral bar carries no brand colour at all: its glyph is the body ink and
     * its washes follow that same on-colour, so both sides of the bar invert with
     * the colour scheme instead of pinning a fixed accent.
     */
    it('washes the neutral bar in its own on-colour, not the brand accent', () => {
        expect(headerOverlayColor(0.08, 'surface')).toBe(alpha(headerColors.surface.fg, 0.08));
        expect(headerOverlayColor(0.08, 'surface')).not.toContain(headerSurfaceAccent);
        expect(headerChipProps('surface').style['--ti-color']).toBe(headerColors.surface.fg);
        // The solid fills still wash in their hand-picked on-colour.
        expect(headerOverlayColor(0.1, 'error')).toBe(alpha(headerColors.error.fg, 0.1));
    });

    it('maps the MUI breakpoint widths so converted dialogs keep their size', () => {
        expect(dialogSize.sm).toBeLessThan(dialogSize.md);
        expect(dialogSize.md).toBeLessThan(dialogSize.lg);
    });
});

describe('PriceDelta', () => {
    it('signals an increase, a decrease and no change', () => {
        const {rerender} = renderWithMantine(<PriceDelta oldPrice={10} newPrice={20}/>);
        expect(screen.getByLabelText('Price increase')).toBeInTheDocument();

        rerender(<PriceDelta oldPrice={20} newPrice={10}/>);
        expect(screen.getByLabelText('Price decrease')).toBeInTheDocument();

        rerender(<PriceDelta oldPrice={10} newPrice={10}/>);
        expect(screen.getByLabelText('No price change')).toBeInTheDocument();
    });
});
