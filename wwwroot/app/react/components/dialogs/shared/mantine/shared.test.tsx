import React from 'react';
import {screen, waitFor} from '@testing-library/react';
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
    headerAccentColor,
    headerOnColor,
    headerOverlayColor,
    dialogShellStyles,
    dialogStickyChromeStyle,
    PriceDelta,
} from './index';
import {alpha} from '@mantine/core';
import {getHeaderColors, getHeaderAccents, getHeaderSurfaceAccent} from './styles';
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
 * Mantine caps the modal at ~90dvh, and something has to absorb that cap: a shell
 * that simply clips strands everything past it, the footer's confirm button
 * included. The body absorbs it, so the scrollbar stays inside the body instead of
 * running the full height of the dialog beside the solid header bar.
 */
describe('DialogShell scrolling', () => {
    it('scrolls the body alone, leaving the shell itself clipped', () => {
        renderWithMantine(
            <DialogShell opened onClose={jest.fn()}>
                <DialogHeader icon={<span/>} title="Edit price" onClose={jest.fn()}/>
                <div data-testid="dialog-body">Body</div>
                <DialogFooter onCancel={jest.fn()} onConfirm={jest.fn()} confirmLabel="Save"/>
            </DialogShell>,
        );

        // `Modal.Content` is the role="dialog" node.
        expect(screen.getByRole('dialog')).toHaveStyle({overflow: 'hidden', flexDirection: 'column'});

        // Read off the inline style: jsdom's computed style drops `overflow-y`.
        const scrollRegion = screen.getByRole('dialog').querySelector<HTMLElement>('[data-dialog-scroll]')!;
        expect(scrollRegion).toContainElement(screen.getByTestId('dialog-body'));
        expect(scrollRegion.style).toMatchObject({overflowY: 'auto', minHeight: '0', flex: '1 1 auto'});
        expect(scrollRegion).not.toContainElement(screen.getByRole('button', {name: 'Close dialog'}));
        expect(scrollRegion).not.toContainElement(screen.getByRole('button', {name: 'Cancel'}));
    });

    it('still lets a caller override the shell styles', () => {
        renderWithMantine(
            <DialogShell opened onClose={jest.fn()} styles={{content: {overflowY: 'scroll'}}}>
                <DialogHeader icon={<span/>} title="Edit price" onClose={jest.fn()}/>
            </DialogShell>,
        );
        // …without losing the column layout the scrolling body depends on.
        expect(screen.getByRole('dialog')).toHaveStyle({overflowY: 'scroll', display: 'flex'});
    });

    it('pins the header and the footer so the actions stay on screen while the body scrolls', () => {
        renderDialog();
        expect(screen.getByRole('button', {name: 'Close dialog'}).parentElement)
            .toHaveStyle({position: 'sticky', top: '0px'});
        expect(screen.getByRole('button', {name: 'Cancel'}).parentElement)
            .toHaveStyle({position: 'sticky', bottom: '0px'});
    });

    /*
     * Mantine drives the modal transition through useDidUpdate, which skips the
     * first render — so a dialog that mounts already open never reports that it
     * finished opening. Every dialog here mounts that way: reactDialogHost's very
     * first render is the one with open=true.
     *
     * This is a trap, not a preference. EditAddressDialog originally gated its
     * HERE map on MUI's onEntered, which did fire on mount; translated literally,
     * the map would simply never have initialised, with nothing to say so.
     *
     * env: 'default' throughout — env="test" strips transitions entirely, and a
     * transition that never runs never reports anything either way.
     */
    it('does not report a transition for a dialog that mounts already open', async () => {
        const onEntered = jest.fn();

        renderWithMantine(
            <DialogShell opened onClose={jest.fn()} transitionProps={{onEntered}}>
                <DialogHeader icon={<span/>} title="Edit price" onClose={jest.fn()}/>
            </DialogShell>,
            {env: 'default'},
        );

        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
        expect(onEntered).not.toHaveBeenCalled();
    });

    it('does forward the callback once a mounted dialog is opened', async () => {
        const onEntered = jest.fn();
        const shell = (opened: boolean) => (
            <DialogShell opened={opened} onClose={jest.fn()} transitionProps={{onEntered}}>
                <DialogHeader icon={<span/>} title="Edit price" onClose={jest.fn()}/>
            </DialogShell>
        );

        const {rerender} = renderWithMantine(shell(false), {env: 'default'});
        rerender(shell(true));

        await waitFor(() => expect(onEntered).toHaveBeenCalled());
    });

    it('exposes the shell and chrome styles as plain objects', () => {
        expect(dialogShellStyles.content).toMatchObject({display: 'flex', overflow: 'hidden'});
        expect(dialogShellStyles.body).toMatchObject({padding: 0, flex: '1 1 auto', minHeight: 0});
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
    it('paints every variant\'s chrome with the same neutral bar and keyline', () => {
        const chrome = headerChromeStyle('error');
        expect(chrome.backgroundColor).toBe(headerColors.error.bg);
        expect(chrome.color).toBe(headerColors.error.fg);
        expect(chrome.display).toBe('flex');
        expect(chrome.borderBottom).toBe('1px solid var(--mantine-color-default-border)');
        // No variant gets a solid colour fill any more — that's the whole point.
        expect(headerChromeStyle('error')).toEqual(headerChromeStyle('surface'));
    });

    it('defaults to the primary variant', () => {
        expect(headerChromeStyle().backgroundColor).toBe(headerColors.primary.bg);
        expect(headerOnColor()).toBe(headerColors.primary.fg);
    });

    it('sizes the icon chip and scrims it in the variant accent, not the bar', () => {
        // A ThemeIcon prop bag, not a style object: size/radius are real props
        // and the scrim rides ThemeIcon's own CSS variables.
        expect(headerChipProps('warning')).toMatchObject({size: 40, radius: 'md'});
        expect(headerChipProps('warning', 32)).toMatchObject({size: 32});
        expect(headerChipProps('warning').style['--ti-bg']).toBe(alpha(headerAccentColor('warning'), 0.15));
        expect(headerChipProps('warning').style['--ti-color']).toBe(headerAccentColor('warning'));
    });

    it('gives the icon chip the tenant primary accent — matching the MUI dialogs', () => {
        // Asserted through the factory rather than the module-level `headerAccents`,
        // which is bound to whichever tenant the bundle booted in.
        //
        // These must equal the MUI `headerChromeSx` fill (`palette.primary.main`) so
        // a Mantine dialog and an unmigrated MUI one opened in the same session
        // signal the same primary colour, even though the bar itself is neutral now.
        expect(getHeaderAccents(true).primary).toBe(dfrntPrimaryPalette[500]);
        expect(getHeaderAccents(false).primary).toBe(urgentPrimaryPalette[500]);
    });

    it('keeps the neutral bar off the tenant switch entirely, including primary', () => {
        for (const variant of ['primary', 'secondary', 'info', 'success', 'warning', 'error', 'surface'] as const) {
            expect(getHeaderColors(false)[variant]).toEqual(getHeaderColors(true)[variant]);
        }
        // The on-paper brand accent still follows the tenant, even though the neutral
        // bar no longer uses it.
        expect(getHeaderSurfaceAccent(false)).toBe(dfrntBrand.goldDeep);
        expect(getHeaderSurfaceAccent(true)).not.toBe(getHeaderSurfaceAccent(false));
    });

    /**
     * The neutral bar carries no brand colour at all: its glyph is the body ink and
     * its washes follow that same on-colour, so both sides of the bar invert with
     * the colour scheme instead of pinning a fixed accent. Semantic meaning lives
     * entirely in the icon chip's accent now, see `headerAccentColor`.
     */
    it('washes the neutral bar in its own on-colour, not the brand accent', () => {
        expect(headerOverlayColor(0.08, 'surface')).toBe(alpha(headerColors.surface.fg, 0.08));
        expect(headerOverlayColor(0.08, 'surface')).not.toContain(headerSurfaceAccent);
        expect(headerChipProps('surface').style['--ti-color']).toBe(headerAccentColor('surface'));
        // Every variant washes the same neutral on-colour now — the bar itself has none to keep.
        expect(headerOverlayColor(0.1, 'error')).toBe(headerOverlayColor(0.1, 'surface'));
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
